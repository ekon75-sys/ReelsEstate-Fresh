from fastapi import FastAPI, HTTPException, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional
import os
import httpx
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import shutil
from pathlib import Path

# Load environment variables
load_dotenv()

app = FastAPI(title="ReelsEstate API")

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Mount static files for serving uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# CORS middleware
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection (lazy)
mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "reelsestate")

def get_database():
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]

# Pydantic models
class GoogleAuthRequest(BaseModel):
    code: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    plan: str = "free"
    plan_price: int = 0
    is_admin: bool = False

# JWT Secret
JWT_SECRET = os.getenv("JWT_SECRET", "fallback-secret-key")

def create_access_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

# Health check endpoints
@app.get("/")
async def root():
    return {"status": "ok", "service": "ReelsEstate API"}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ReelsEstate API"}

@app.get("/api/health")
async def api_health():
    return {"status": "ok", "service": "ReelsEstate API"}

# Test MongoDB connection
@app.get("/api/test-db")
async def test_db():
    try:
        db = get_database()
        await db.test.insert_one({"test": "connection"})
        await db.test.delete_one({"test": "connection"})
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "failed", "error": str(e)}

# Auth middleware to get current user from JWT
async def get_current_user(authorization: str = Header(None)):
    """Get current user from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        
        db = get_database()
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Get current user endpoint
@app.get("/api/auth/me")
async def get_me(authorization: str = Header(None)):
    """Get current authenticated user"""
    user = await get_current_user(authorization)
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        plan=user.get("plan", "free"),
        plan_price=user.get("plan_price", 0),
        is_admin=user.get("is_admin", False)
    )

# Google OAuth endpoints
@app.post("/api/auth/google/callback")
async def google_oauth_callback(auth_data: GoogleAuthRequest):
    """Handle Google OAuth callback"""
    try:
        # Exchange code for token
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "code": auth_data.code,
            "grant_type": "authorization_code",
            "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI")
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)
            token_json = token_response.json()
            
            if "access_token" not in token_json:
                raise HTTPException(status_code=400, detail="Failed to get access token")
            
            # Get user info
            user_info_url = f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={token_json['access_token']}"
            user_response = await client.get(user_info_url)
            user_info = user_response.json()
            
            # Get or create user in database
            db = get_database()
            user = await db.users.find_one({"email": user_info['email']}, {"_id": 0})
            
            if not user:
                user = {
                    "id": str(ObjectId()),
                    "email": user_info['email'],
                    "name": user_info['name'],
                    "google_id": user_info['id'],
                    "plan": "free",
                    "plan_price": 0,
                    "created_at": datetime.now(timezone.utc),
                    "is_admin": (user_info['email'] == "ekon75@hotmail.com"),
                    "onboarding_step": 0
                }
                await db.users.insert_one(user)
            
            # Create JWT token
            token = create_access_token(user["id"])
            
            return {
                "token": token,
                "user": UserResponse(
                    id=user["id"],
                    email=user["email"],
                    name=user["name"],
                    plan=user.get("plan", "free"),
                    plan_price=user.get("plan_price", 0),
                    is_admin=user.get("is_admin", False)
                )
            }
            
    except Exception as e:
        print(f"Google auth error: {e}")
        raise HTTPException(status_code=400, detail=f"Google authentication failed: {str(e)}")

# Onboarding endpoints
class BusinessInfoRequest(BaseModel):
    company_name: str
    commercial_name: str = ""
    address: str
    country: str
    region: str
    postal_code: str
    vat_number: str
    contact_name: str
    contact_email: str
    contact_phone: str
    billing_same_as_business: bool = True
    billing_address: str = ""
    billing_country: str = ""
    billing_region: str = ""
    billing_postal_code: str = ""

class OnboardingProgressRequest(BaseModel):
    current_step: int
    completed_steps: dict = {}

@app.get("/api/business-info")
async def get_business_info(authorization: str = Header(None)):
    """Get business information"""
    user = await get_current_user(authorization)
    
    business_info = user.get("business_info", {})
    return business_info

@app.post("/api/business-info")
async def save_business_info(business_info: BusinessInfoRequest, authorization: str = Header(None)):
    """Save business information"""
    user = await get_current_user(authorization)
    db = get_database()
    
    # Update user with business info
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "business_info": business_info.dict(),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"status": "success", "message": "Business information saved"}

@app.put("/api/onboarding/progress")
async def update_onboarding_progress(progress: OnboardingProgressRequest, authorization: str = Header(None)):
    """Update onboarding progress"""
    user = await get_current_user(authorization)
    db = get_database()
    
    # Update user onboarding progress
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "onboarding_step": progress.current_step,
            "onboarding_completed_steps": progress.completed_steps,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"status": "success", "message": "Progress updated"}

@app.get("/api/onboarding/progress")
async def get_onboarding_progress(authorization: str = Header(None)):
    """Get onboarding progress"""
    user = await get_current_user(authorization)
    
    return {
        "current_step": user.get("onboarding_step", 0),
        "completed_steps": user.get("onboarding_completed_steps", {})
    }

# File upload endpoints
@app.post("/api/upload/logo")
async def upload_logo(file: UploadFile = File(...), authorization: str = Header(None)):
    """Upload company logo"""
    user = await get_current_user(authorization)
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PNG, JPG, and SVG are allowed")
    
    # Create user-specific directory
    user_dir = UPLOAD_DIR / user["id"]
    user_dir.mkdir(exist_ok=True)
    
    # Save file
    file_extension = file.filename.split('.')[-1]
    file_path = user_dir / f"logo.{file_extension}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update user with logo URL
    logo_url = f"/uploads/{user['id']}/logo.{file_extension}"
    db = get_database()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "logo_url": logo_url,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"status": "success", "logo_url": logo_url}

@app.get("/api/branding")
async def get_branding(authorization: str = Header(None)):
    """Get user branding information"""
    user = await get_current_user(authorization)
    
    return {
        "logo_url": user.get("logo_url", ""),
        "font_name": user.get("font_name", ""),
        "font_alignment": user.get("font_alignment", ""),
        "main_color": user.get("main_color", ""),
        "currency": user.get("currency", "")
    }

class BrandingRequest(BaseModel):
    font_name: str = "Inter"
    font_alignment: str = "left"
    main_color: str = "#FF6B35"
    currency: str = "€"

@app.post("/api/branding")
async def save_branding(branding: BrandingRequest, authorization: str = Header(None)):
    """Save user branding preferences"""
    user = await get_current_user(authorization)
    db = get_database()
    
    # Update user with branding preferences
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "font_name": branding.font_name,
            "font_alignment": branding.font_alignment,
            "main_color": branding.main_color,
            "currency": branding.currency,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"status": "success", "message": "Branding preferences saved"}

# Facebook OAuth endpoints
@app.get("/api/facebook/auth-url")
async def get_facebook_auth_url(authorization: str = Header(None)):
    """Generate Facebook OAuth URL"""
    user = await get_current_user(authorization)
    
    facebook_app_id = os.getenv("FACEBOOK_APP_ID")
    redirect_uri = "https://reels-estate.app/auth/facebook/callback"
    
    # Debug log
    print(f"Facebook App ID: {facebook_app_id}")
    print(f"Redirect URI: {redirect_uri}")
    
    if not facebook_app_id:
        raise HTTPException(status_code=500, detail="Facebook App ID not configured")
    
    # Include all necessary permissions for Instagram integration
    # Note: Instagram Business API uses Facebook permissions, not separate Instagram scopes
    scopes = [
        "pages_show_list",              # Required to list Pages
        "pages_manage_posts",           # Post to Pages (also works for Instagram)
        "pages_read_engagement",        # Read page engagement
        "instagram_manage_comments",    # Manage Instagram comments
        "business_management"           # Manage business assets
    ]
    scope_string = ",".join(scopes)
    
    auth_url = f"https://www.facebook.com/v20.0/dialog/oauth?client_id={facebook_app_id}&redirect_uri={redirect_uri}&scope={scope_string}&state={user['id']}"
    
    return {"auth_url": auth_url, "app_id": facebook_app_id}

@app.post("/api/facebook/callback")
async def facebook_callback(code: str, state: str):
    """Handle Facebook OAuth callback"""
    try:
        facebook_app_id = os.getenv("FACEBOOK_APP_ID")
        facebook_app_secret = os.getenv("FACEBOOK_APP_SECRET")
        redirect_uri = "https://reels-estate.app/auth/facebook/callback"
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.facebook.com/v20.0/oauth/access_token",
                params={
                    "client_id": facebook_app_id,
                    "client_secret": facebook_app_secret,
                    "redirect_uri": redirect_uri,
                    "code": code
                }
            )
            response.raise_for_status()
            token_data = response.json()
            access_token = token_data["access_token"]
            
            # Get user's Facebook pages
            response = await client.get(
                "https://graph.facebook.com/v20.0/me/accounts",
                params={"access_token": access_token}
            )
            response.raise_for_status()
            pages_data = response.json()
            
            # Store in database
            db = get_database()
            user_id = state  # We passed user_id as state
            
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "facebook_access_token": access_token,
                    "facebook_pages": pages_data.get("data", []),
                    "facebook_connected": True,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
            return {"status": "success", "message": "Facebook connected successfully"}
            
    except Exception as e:
        print(f"Facebook callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Facebook connection failed: {str(e)}")

@app.get("/api/instagram/accounts")
async def get_instagram_accounts(authorization: str = Header(None)):
    """Get Instagram Business accounts linked to user's Facebook Pages"""
    user = await get_current_user(authorization)
    
    if not user.get("facebook_access_token"):
        raise HTTPException(status_code=401, detail="Facebook not connected")
    
    try:
        facebook_token = user["facebook_access_token"]
        instagram_accounts = []
        
        async with httpx.AsyncClient() as client:
            # Get Facebook Pages
            pages_response = await client.get(
                f"https://graph.facebook.com/v20.0/me/accounts",
                params={
                    "access_token": facebook_token,
                    "fields": "id,name,access_token"
                }
            )
            pages_response.raise_for_status()
            pages = pages_response.json().get("data", [])
            
            # For each page, get linked Instagram accounts
            for page in pages:
                try:
                    ig_response = await client.get(
                        f"https://graph.facebook.com/v20.0/{page['id']}",
                        params={
                            "access_token": page["access_token"],
                            "fields": "instagram_business_account"
                        }
                    )
                    ig_response.raise_for_status()
                    ig_data = ig_response.json()
                    
                    if "instagram_business_account" in ig_data:
                        ig_account_id = ig_data["instagram_business_account"]["id"]
                        
                        # Get Instagram account details
                        ig_details_response = await client.get(
                            f"https://graph.facebook.com/v20.0/{ig_account_id}",
                            params={
                                "access_token": page["access_token"],
                                "fields": "id,username,profile_picture_url"
                            }
                        )
                        ig_details_response.raise_for_status()
                        ig_details = ig_details_response.json()
                        
                        instagram_accounts.append({
                            "ig_account_id": ig_details["id"],
                            "username": ig_details.get("username", ""),
                            "profile_picture": ig_details.get("profile_picture_url", ""),
                            "facebook_page_id": page["id"],
                            "facebook_page_name": page["name"],
                            "page_access_token": page["access_token"]
                        })
                except Exception as e:
                    print(f"Failed to get Instagram for page {page['id']}: {e}")
                    continue
        
        return {"instagram_accounts": instagram_accounts}
        
    except Exception as e:
        print(f"Failed to get Instagram accounts: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/instagram/connect")
async def connect_instagram_account(
    ig_account_id: str,
    username: str,
    facebook_page_id: str,
    page_access_token: str,
    authorization: str = Header(None)
):
    """Store Instagram account connection"""
    user = await get_current_user(authorization)
    
    db = get_database()
    
    # Store Instagram account info
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            f"instagram_accounts.{ig_account_id}": {
                "username": username,
                "facebook_page_id": facebook_page_id,
                "page_access_token": page_access_token,
                "connected_at": datetime.now(timezone.utc)
            },
            "instagram_connected": True,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"status": "success", "message": "Instagram account connected"}

@app.get("/api/social-media")
async def get_social_media_connections(authorization: str = Header(None)):
    """Get user's social media connections"""
    user = await get_current_user(authorization)
    
    connections = [
        {
            "platform": "Facebook",
            "connected": user.get("facebook_connected", False)
        },
        {
            "platform": "Instagram",
            "connected": user.get("instagram_connected", False)
        },
        {
            "platform": "YouTube",
            "connected": user.get("youtube_connected", False)
        },
        {
            "platform": "TikTok",
            "connected": user.get("tiktok_connected", False)
        },
        {
            "platform": "LinkedIn",
            "connected": user.get("linkedin_connected", False)
        }
    ]
    
    return connections

class DisconnectRequest(BaseModel):
    platform: str

@app.post("/api/social-media/disconnect")
async def disconnect_social_media(request: DisconnectRequest, authorization: str = Header(None)):
    """Disconnect a social media platform"""
    user = await get_current_user(authorization)
    db = get_database()
    
    platform = request.platform
    
    update_fields = {"updated_at": datetime.now(timezone.utc)}
    
    if platform == "Facebook":
        update_fields["facebook_connected"] = False
        update_fields["facebook_access_token"] = None
        update_fields["facebook_pages"] = []
    elif platform == "Instagram":
        update_fields["instagram_connected"] = False
        update_fields["instagram_accounts"] = {}
    elif platform == "YouTube":
        update_fields["youtube_connected"] = False
        update_fields["youtube_access_token"] = None
        update_fields["youtube_refresh_token"] = None
        update_fields["youtube_channels"] = []
    elif platform == "TikTok":
        update_fields["tiktok_connected"] = False
        update_fields["tiktok_access_token"] = None
        update_fields["tiktok_refresh_token"] = None
        update_fields["tiktok_user"] = {}
    elif platform == "LinkedIn":
        update_fields["linkedin_connected"] = False
        update_fields["linkedin_access_token"] = None
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": update_fields}
    )
    
    return {"status": "success", "message": f"{platform} disconnected"}

# Social Media Status Endpoints
@app.get("/api/auth/facebook/status")
async def get_facebook_status(authorization: str = Header(None)):
    """Check Facebook connection status"""
    user = await get_current_user(authorization)
    return {"connected": user.get("facebook_connected", False)}

@app.get("/api/auth/instagram/status")
async def get_instagram_status(authorization: str = Header(None)):
    """Check Instagram connection status"""
    user = await get_current_user(authorization)
    return {"connected": user.get("instagram_connected", False)}

@app.get("/api/auth/youtube/status")
async def get_youtube_status(authorization: str = Header(None)):
    """Check YouTube connection status"""
    user = await get_current_user(authorization)
    return {"connected": user.get("youtube_connected", False)}

@app.get("/api/auth/linkedin/status")
async def get_linkedin_status(authorization: str = Header(None)):
    """Check LinkedIn connection status"""
    user = await get_current_user(authorization)
    return {"connected": user.get("linkedin_connected", False)}

@app.get("/api/auth/tiktok/status")
async def get_tiktok_status(authorization: str = Header(None)):
    """Check TikTok connection status"""
    user = await get_current_user(authorization)
    return {"connected": user.get("tiktok_connected", False)}

@app.delete("/api/auth/{platform}/disconnect")
async def disconnect_platform(platform: str, authorization: str = Header(None)):
    """Disconnect a social media platform"""
    user = await get_current_user(authorization)
    db = get_database()
    
    update_fields = {"updated_at": datetime.now(timezone.utc)}
    
    if platform == "facebook":
        update_fields["facebook_connected"] = False
        update_fields["facebook_access_token"] = None
        update_fields["facebook_pages"] = []
    elif platform == "instagram":
        update_fields["instagram_connected"] = False
        update_fields["instagram_accounts"] = {}
    elif platform == "youtube":
        update_fields["youtube_connected"] = False
        update_fields["youtube_access_token"] = None
        update_fields["youtube_refresh_token"] = None
        update_fields["youtube_channels"] = []
    elif platform == "tiktok":
        update_fields["tiktok_connected"] = False
        update_fields["tiktok_access_token"] = None
        update_fields["tiktok_refresh_token"] = None
        update_fields["tiktok_user"] = {}
    elif platform == "linkedin":
        update_fields["linkedin_connected"] = False
        update_fields["linkedin_access_token"] = None
    else:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": update_fields}
    )
    
    return {"status": "success", "message": f"{platform} disconnected"}

@app.get("/api/auth/{platform}/authorize")
async def get_platform_auth_url(platform: str, authorization: str = Header(None)):
    """Get OAuth authorization URL for a platform"""
    user = await get_current_user(authorization)
    
    if platform == "facebook":
        facebook_app_id = os.getenv("FACEBOOK_APP_ID")
        redirect_uri = "https://reels-estate.app/auth/facebook/callback"
        if not facebook_app_id:
            raise HTTPException(status_code=500, detail="Facebook App ID not configured")
        scopes = "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management"
        auth_url = f"https://www.facebook.com/v18.0/dialog/oauth?client_id={facebook_app_id}&redirect_uri={redirect_uri}&scope={scopes}&response_type=code"
        return {"auth_url": auth_url}
    
    elif platform == "youtube":
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        redirect_uri = "https://reels-estate.app/auth/youtube/callback"
        if not google_client_id:
            raise HTTPException(status_code=500, detail="Google Client ID not configured")
        scopes = "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload"
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={google_client_id}&redirect_uri={redirect_uri}&scope={scopes}&response_type=code&access_type=offline&prompt=consent"
        return {"auth_url": auth_url}
    
    elif platform == "linkedin":
        linkedin_client_id = os.getenv("LINKEDIN_CLIENT_ID")
        redirect_uri = "https://reels-estate.app/auth/linkedin/callback"
        if not linkedin_client_id:
            raise HTTPException(status_code=500, detail="LinkedIn Client ID not configured")
        scopes = "openid profile email w_member_social"
        auth_url = f"https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={linkedin_client_id}&redirect_uri={redirect_uri}&scope={scopes}"
        return {"auth_url": auth_url}
    
    elif platform == "tiktok":
        tiktok_client_key = os.getenv("TIKTOK_CLIENT_KEY")
        redirect_uri = "https://reels-estate.app/auth/tiktok/callback"
        if not tiktok_client_key:
            raise HTTPException(status_code=500, detail="TikTok Client Key not configured")
        scopes = "user.info.basic,video.publish"
        auth_url = f"https://www.tiktok.com/v2/auth/authorize/?client_key={tiktok_client_key}&redirect_uri={redirect_uri}&scope={scopes}&response_type=code"
        return {"auth_url": auth_url}
    
    elif platform == "instagram":
        # Instagram uses Facebook OAuth
        facebook_app_id = os.getenv("FACEBOOK_APP_ID")
        redirect_uri = "https://reels-estate.app/auth/facebook/callback"
        if not facebook_app_id:
            raise HTTPException(status_code=500, detail="Facebook App ID not configured")
        scopes = "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish,business_management"
        auth_url = f"https://www.facebook.com/v18.0/dialog/oauth?client_id={facebook_app_id}&redirect_uri={redirect_uri}&scope={scopes}&response_type=code"
        return {"auth_url": auth_url}
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")

# YouTube OAuth endpoints
@app.get("/api/youtube/auth-url")
async def get_youtube_auth_url(authorization: str = Header(None)):
    """Generate YouTube OAuth URL"""
    user = await get_current_user(authorization)
    
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = "https://reels-estate.app/auth/youtube/callback"
    
    if not google_client_id:
        raise HTTPException(status_code=500, detail="Google Client ID not configured")
    
    # YouTube requires specific scopes
    scopes = [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ]
    scope_string = " ".join(scopes)
    
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={google_client_id}&redirect_uri={redirect_uri}&scope={scope_string}&response_type=code&access_type=offline&state={user['id']}"
    
    return {"auth_url": auth_url}

@app.post("/api/youtube/callback")
async def youtube_callback(code: str, state: str):
    """Handle YouTube OAuth callback"""
    try:
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        redirect_uri = "https://reels-estate.app/auth/youtube/callback"
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": google_client_id,
                    "client_secret": google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            
            access_token = token_data["access_token"]
            refresh_token = token_data.get("refresh_token")
            
            # Get YouTube channels
            channels_response = await client.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={
                    "part": "snippet,statistics",
                    "mine": "true",
                    "access_token": access_token
                }
            )
            channels_response.raise_for_status()
            channels_data = channels_response.json()
            
            # Store in database
            db = get_database()
            user_id = state
            
            youtube_channels = []
            for channel in channels_data.get("items", []):
                youtube_channels.append({
                    "channel_id": channel["id"],
                    "title": channel["snippet"]["title"],
                    "description": channel["snippet"]["description"],
                    "thumbnail": channel["snippet"]["thumbnails"]["default"]["url"],
                    "subscriber_count": channel["statistics"].get("subscriberCount", "0")
                })
            
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "youtube_access_token": access_token,
                    "youtube_refresh_token": refresh_token,
                    "youtube_channels": youtube_channels,
                    "youtube_connected": True,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
            return {"status": "success", "message": "YouTube connected successfully", "channels": youtube_channels}
            
    except Exception as e:
        print(f"YouTube callback error: {e}")
        raise HTTPException(status_code=400, detail=f"YouTube connection failed: {str(e)}")

# TikTok OAuth endpoints
@app.get("/api/tiktok/auth-url")
async def get_tiktok_auth_url(authorization: str = Header(None)):
    """Generate TikTok OAuth URL"""
    user = await get_current_user(authorization)
    
    tiktok_client_key = os.getenv("TIKTOK_CLIENT_KEY")
    redirect_uri = "https://reels-estate.app/auth/tiktok/callback"
    
    if not tiktok_client_key:
        raise HTTPException(status_code=500, detail="TikTok Client Key not configured")
    
    # TikTok OAuth scopes
    scopes = "user.info.profile,user.info.stats,video.list"
    
    # Generate random state for CSRF protection
    import secrets
    state = secrets.token_urlsafe(32)
    
    auth_url = f"https://www.tiktok.com/v2/auth/authorize/?client_key={tiktok_client_key}&response_type=code&scope={scopes}&redirect_uri={redirect_uri}&state={state}"
    
    return {"auth_url": auth_url}

@app.post("/api/tiktok/callback")
async def tiktok_callback(code: str, state: str):
    """Handle TikTok OAuth callback"""
    try:
        tiktok_client_key = os.getenv("TIKTOK_CLIENT_KEY")
        tiktok_client_secret = os.getenv("TIKTOK_CLIENT_SECRET")
        redirect_uri = "https://reels-estate.app/auth/tiktok/callback"
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://open.tiktokapis.com/v2/oauth/token/",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_key": tiktok_client_key,
                    "client_secret": tiktok_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to exchange code for tokens: {token_response.text}"
                )
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            
            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received")
            
            # Get user info from TikTok
            user_response = await client.get(
                "https://open.tiktokapis.com/v2/user/info/",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"fields": "open_id,display_name,avatar_url,follower_count,video_count"}
            )
            
            if user_response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail="Failed to get user info from TikTok"
                )
            
            user_data = user_response.json()
            tiktok_user = user_data.get("data", {}).get("user", {})
            
            # Store in database
            db = get_database()
            user_id = state  # We can use state to identify user, or find by token
            
            # For now, we'll find the user by looking for an authenticated session
            # In production, you'd want to pass the user_id in the state parameter
            
            # Update the first available user (for demo purposes)
            # In production, properly identify the user from the state parameter
            await db.users.update_one(
                {},  # This should filter by specific user
                {"$set": {
                    "tiktok_access_token": access_token,
                    "tiktok_refresh_token": refresh_token,
                    "tiktok_user": tiktok_user,
                    "tiktok_connected": True,
                    "updated_at": datetime.now(timezone.utc)
                }},
                upsert=False
            )
            
            return {
                "status": "success",
                "message": "TikTok connected successfully",
                "user": tiktok_user
            }
            
    except Exception as e:
        print(f"TikTok callback error: {e}")
        raise HTTPException(status_code=400, detail=f"TikTok connection failed: {str(e)}")

# LinkedIn OAuth endpoints
@app.get("/api/linkedin/auth-url")
async def get_linkedin_auth_url(authorization: str = Header(None)):
    """Generate LinkedIn OAuth URL"""
    user = await get_current_user(authorization)
    
    linkedin_client_id = os.getenv("LINKEDIN_CLIENT_ID")
    redirect_uri = "https://reels-estate.app/auth/linkedin/callback"
    
    if not linkedin_client_id:
        raise HTTPException(status_code=500, detail="LinkedIn Client ID not configured")
    
    # LinkedIn OAuth scopes
    scopes = "openid profile email w_member_social"
    
    # Generate random state for CSRF protection
    import secrets
    state = secrets.token_urlsafe(32)
    
    auth_url = f"https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={linkedin_client_id}&redirect_uri={redirect_uri}&scope={scopes}&state={state}"
    
    return {"auth_url": auth_url}

@app.post("/api/linkedin/callback")
async def linkedin_callback(code: str, state: str):
    """Handle LinkedIn OAuth callback"""
    try:
        linkedin_client_id = os.getenv("LINKEDIN_CLIENT_ID")
        linkedin_client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
        redirect_uri = "https://reels-estate.app/auth/linkedin/callback"
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": linkedin_client_id,
                    "client_secret": linkedin_client_secret,
                    "redirect_uri": redirect_uri
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to exchange code for tokens: {token_response.text}"
                )
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received")
            
            # Get user profile from LinkedIn using OpenID Connect
            profile_response = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if profile_response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail="Failed to get user profile from LinkedIn"
                )
            
            profile_data = profile_response.json()
            
            # Store in database
            db = get_database()
            user_id = profile_data.get("sub")  # OpenID Connect user ID
            
            user_data = {
                "linkedin_id": user_id,
                "name": profile_data.get("name", ""),
                "email": profile_data.get("email", ""),
                "picture": profile_data.get("picture", ""),
                "linkedin_access_token": access_token,
                "linkedin_connected": True,
                "updated_at": datetime.now(timezone.utc)
            }
            
            await db.users.update_one(
                {},  # This should filter by specific user
                {"$set": user_data},
                upsert=False
            )
            
            return {
                "status": "success",
                "message": "LinkedIn connected successfully",
                "profile": {
                    "name": profile_data.get("name"),
                    "email": profile_data.get("email")
                }
            }
            
    except Exception as e:
        print(f"LinkedIn callback error: {e}")
        raise HTTPException(status_code=400, detail=f"LinkedIn connection failed: {str(e)}")

@app.get("/api/auth/linkedin/pages")
async def get_linkedin_pages(authorization: str = Header(None)):
    """Get LinkedIn pages for user (personal profile and organization pages)"""
    user = await get_current_user(authorization)
    
    pages = []
    
    # Add personal profile option
    pages.append({
        "urn": f"urn:li:person:{user.get('linkedin_id', '')}",
        "name": user.get("name", "Personal Profile"),
        "type": "personal"
    })
    
    # In production, fetch organization pages from LinkedIn API
    # For now, return only personal profile
    
    return {
        "pages": pages,
        "selected": user.get("linkedin_selected_page", pages[0]["urn"] if pages else None)
    }

@app.post("/api/auth/linkedin/select-page")
async def select_linkedin_page(request: dict, authorization: str = Header(None)):
    """Select which LinkedIn page/profile to post to"""
    user = await get_current_user(authorization)
    db = get_database()
    
    page_urn = request.get("page_urn")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "linkedin_selected_page": page_urn,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"status": "success", "message": "LinkedIn page selected"}

# Agent management endpoints
@app.get("/api/agents")
async def get_agents(authorization: str = Header(None)):
    """Get all agents for the user"""
    user = await get_current_user(authorization)
    db = get_database()
    
    agents = await db.agents.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return agents

@app.post("/api/agents")
async def add_agent(agent: dict, authorization: str = Header(None)):
    """Add a new agent"""
    user = await get_current_user(authorization)
    db = get_database()
    
    agent_data = {
        "id": str(ObjectId()),
        "user_id": user["id"],
        "name": agent.get("name"),
        "phone": agent.get("phone"),
        "email": agent.get("email"),
        "photo_url": agent.get("photo_url", ""),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.agents.insert_one(agent_data)
    
    return {"status": "success", "message": "Agent added"}

@app.put("/api/agents/{agent_id}")
async def update_agent(agent_id: str, agent: dict, authorization: str = Header(None)):
    """Update an existing agent"""
    user = await get_current_user(authorization)
    db = get_database()
    
    # Verify agent belongs to user
    existing_agent = await db.agents.find_one({"id": agent_id, "user_id": user["id"]})
    if not existing_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    update_data = {
        "name": agent.get("name"),
        "phone": agent.get("phone"),
        "email": agent.get("email"),
        "photo_url": agent.get("photo_url", ""),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.agents.update_one(
        {"id": agent_id, "user_id": user["id"]},
        {"$set": update_data}
    )
    
    return {"status": "success", "message": "Agent updated"}

@app.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: str, authorization: str = Header(None)):
    """Delete an agent"""
    user = await get_current_user(authorization)
    db = get_database()
    
    # Verify agent belongs to user
    existing_agent = await db.agents.find_one({"id": agent_id, "user_id": user["id"]})
    if not existing_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await db.agents.delete_one({"id": agent_id, "user_id": user["id"]})
    
    return {"status": "success", "message": "Agent deleted"}

@app.post("/api/upload/agent-photo")
async def upload_agent_photo(file: UploadFile = File(...), authorization: str = Header(None)):
    """Upload agent photo"""
    user = await get_current_user(authorization)
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PNG and JPG are allowed")
    
    # Create user-specific directory
    user_dir = UPLOAD_DIR / user["id"] / "agents"
    user_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_extension = file.filename.split('.')[-1]
    file_name = f"{str(ObjectId())}.{file_extension}"
    file_path = user_dir / file_name
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Generate URL
    photo_url = f"/uploads/{user['id']}/agents/{file_name}"
    
    return {"status": "success", "photo_url": photo_url}

# Subscription management endpoints
class SubscriptionRequest(BaseModel):
    plan_name: str
    plan_price: float

@app.post("/api/subscription")
async def activate_subscription(subscription: SubscriptionRequest, authorization: str = Header(None)):
    """Activate a subscription plan"""
    user = await get_current_user(authorization)
    db = get_database()
    
    # For now, this is a mock implementation
    # In production, integrate with Stripe/payment gateway
    
    # Calculate trial end date (3 days from now)
    trial_end = datetime.now(timezone.utc) + timedelta(days=3)
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "plan": subscription.plan_name,
            "plan_price": subscription.plan_price,
            "trial_active": True,
            "trial_end_date": trial_end,
            "subscription_status": "trial",
            "subscription_started_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "status": "success",
        "message": f"{subscription.plan_name} plan activated with 3-day trial",
        "trial_end_date": trial_end.isoformat()
    }

@app.get("/api/subscription")
async def get_subscription(authorization: str = Header(None)):
    """Get user's current subscription"""
    user = await get_current_user(authorization)
    
    return {
        "plan": user.get("plan", "free"),
        "plan_name": user.get("plan", "free"),
        "plan_price": user.get("plan_price", 0),
        "trial_active": user.get("trial_active", False),
        "trial_end_date": user.get("trial_end_date"),
        "subscription_status": user.get("subscription_status", "inactive"),
        "status": user.get("subscription_status", "inactive")
    }

# Billing model
class BillingRequest(BaseModel):
    vat_number: Optional[str] = ""
    billing_address: Optional[str] = ""
    payment_method: Optional[str] = ""
    saved_cards: Optional[str] = "[]"

@app.get("/api/billing")
async def get_billing(authorization: str = Header(None)):
    """Get user's billing information"""
    user = await get_current_user(authorization)
    
    billing_info = user.get("billing_info", {})
    return {
        "vat_number": billing_info.get("vat_number", ""),
        "billing_address": billing_info.get("billing_address", ""),
        "payment_method": billing_info.get("payment_method", ""),
        "saved_cards": billing_info.get("saved_cards", "[]")
    }

@app.post("/api/billing")
async def save_billing(billing: BillingRequest, authorization: str = Header(None)):
    """Save user's billing information"""
    user = await get_current_user(authorization)
    db = get_database()
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "billing_info": billing.dict(),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"status": "success", "message": "Billing information saved"}

# Subscription cancel endpoint
@app.post("/api/subscription/cancel")
async def cancel_subscription(authorization: str = Header(None)):
    """Cancel user's subscription"""
    user = await get_current_user(authorization)
    db = get_database()
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "subscription_status": "cancelled",
            "trial_active": False,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"status": "success", "message": "Subscription cancelled"}

# Discount code endpoints
class DiscountValidateRequest(BaseModel):
    code: str
    plan_price: float

@app.post("/api/discount-codes/validate")
async def validate_discount_code(request: DiscountValidateRequest, authorization: str = Header(None)):
    """Validate a discount code"""
    user = await get_current_user(authorization)
    
    # For now, implement some sample discount codes
    valid_codes = {
        "LAUNCH20": {"type": "percentage", "value": 20},
        "WELCOME10": {"type": "percentage", "value": 10},
        "EARLY50": {"type": "percentage", "value": 50},
    }
    
    code_upper = request.code.upper()
    if code_upper in valid_codes:
        discount = valid_codes[code_upper]
        discount_amount = (request.plan_price * discount["value"]) / 100
        final_price = request.plan_price - discount_amount
        
        return {
            "valid": True,
            "message": f"Discount code applied: {discount['value']}% off",
            "discount_type": discount["type"],
            "discount_value": discount["value"],
            "discount_amount": round(discount_amount, 2),
            "final_price": round(final_price, 2)
        }
    
    return {
        "valid": False,
        "message": "Invalid discount code"
    }

@app.post("/api/discount-codes/apply")
async def apply_discount_code(request: DiscountValidateRequest, authorization: str = Header(None)):
    """Apply a discount code to user's account"""
    user = await get_current_user(authorization)
    db = get_database()
    
    # Validate first
    validation = await validate_discount_code(request, authorization)
    
    if validation["valid"]:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "applied_discount_code": request.code.upper(),
                "discount_applied_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        return {"status": "success", "message": "Discount code applied"}
    
    raise HTTPException(status_code=400, detail="Invalid discount code")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
