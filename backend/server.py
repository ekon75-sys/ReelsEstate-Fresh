from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
import httpx
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import shutil
from pathlib import Path

# Stripe integration - using official stripe library
import stripe

# Load environment variables
load_dotenv()

app = FastAPI(title="ReelsEstate API")

# Subscription plans - FIXED PRICES (never accept from frontend)
SUBSCRIPTION_PLANS = {
    "basic": {"name": "Basic", "price": 19.99, "currency": "eur"},
    "professional": {"name": "Professional", "price": 39.99, "currency": "eur"},
    "enterprise": {"name": "Enterprise", "price": 99.99, "currency": "eur"},
    "ai_caption": {"name": "AI Caption", "price": 199.99, "currency": "eur"}
}

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Mount static files for serving uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# CORS middleware - specific origins required when using credentials
cors_origins = [
    "https://reels-estate.app",
    "https://www.reels-estate.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
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
    redirect_uri: Optional[str] = None

class EmergentSessionRequest(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

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

@app.get("/api/debug/oauth-config")
async def debug_oauth_config():
    """Debug endpoint to check OAuth configuration"""
    return {
        "google_client_id": os.getenv("GOOGLE_CLIENT_ID", "NOT SET")[:20] + "..." if os.getenv("GOOGLE_CLIENT_ID") else "NOT SET",
        "google_redirect_uri_env": os.getenv("GOOGLE_REDIRECT_URI", "NOT SET"),
        "expected_redirect_uri": "https://reels-estate.app/auth/google/callback"
    }

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

# Auth middleware to get current user from session cookie OR JWT
from fastapi import Depends

async def get_current_user(request: Request, authorization: str = Header(None)):
    """Get current user from session cookie or JWT token"""
    db = get_database()
    
    # Try session cookie first (new method)
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header (old method)
    if not session_token and authorization and authorization.startswith("Bearer "):
        session_token = authorization.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check session in database first
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if session:
        user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
        if user:
            return user
    
    # Fallback: Try JWT decode
    try:
        payload = jwt.decode(session_token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            return user
    except:
        pass
    
    raise HTTPException(status_code=401, detail="Invalid session or token")

# Get current user endpoint
@app.get("/api/auth/me")
async def get_me(request: Request, authorization: str = Header(None)):
    """Get current authenticated user"""
    user = await get_current_user(request, authorization)
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        plan=user.get("plan", "free"),
        plan_price=user.get("plan_price", 0),
        is_admin=user.get("is_admin", False)
    )

# Emergent Auth - exchange session_id for user data (called from frontend)
class EmergentAuthRequest(BaseModel):
    session_id: str

@app.post("/api/auth/emergent-callback")
async def emergent_callback(auth_data: EmergentAuthRequest, response: Response):
    """Exchange Emergent session_id for user data and create session"""
    try:
        # Call Emergent Auth API from backend (avoids CORS issues)
        async with httpx.AsyncClient() as client:
            emergent_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": auth_data.session_id}
            )
            
            if emergent_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to validate session with Emergent Auth")
            
            user_data = emergent_response.json()
        
        db = get_database()
        
        # Check if user exists by email
        user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
        
        if not user:
            # Create new user
            user = {
                "id": f"user_{user_data['id']}",
                "user_id": f"user_{user_data['id']}",
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture"),
                "plan": "free",
                "plan_price": 0,
                "created_at": datetime.now(timezone.utc),
                "is_admin": (user_data["email"] == "ekon75@hotmail.com"),
                "onboarding_step": 0
            }
            await db.users.insert_one(user)
        else:
            # Update existing user's name/picture if changed
            await db.users.update_one(
                {"email": user_data["email"]},
                {"$set": {
                    "name": user_data["name"],
                    "picture": user_data.get("picture"),
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
        
        # Store session in database
        session_token = user_data.get("session_token", auth_data.session_id)
        await db.user_sessions.update_one(
            {"user_id": user["id"]},
            {"$set": {
                "user_id": user["id"],
                "session_token": session_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
        
        # Set httpOnly cookie with session token
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60
        )
        
        return {
            "status": "success",
            "user": {
                "id": user.get("id"),
                "user_id": user.get("id"),
                "email": user.get("email"),
                "name": user.get("name"),
                "onboarding_step": user.get("onboarding_step", 0),
                "plan": user.get("plan", "free")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Emergent callback error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# Emergent Auth endpoint - handles session from Emergent's OAuth
@app.post("/api/auth/emergent-session")
async def emergent_session(session_data: EmergentSessionRequest, response: Response):
    """Process Emergent Auth session and create/update user"""
    try:
        db = get_database()
        
        # Check if user exists by email
        user = await db.users.find_one({"email": session_data.email}, {"_id": 0})
        
        if not user:
            # Create new user
            user = {
                "id": f"user_{session_data.user_id}",
                "user_id": f"user_{session_data.user_id}",
                "email": session_data.email,
                "name": session_data.name,
                "picture": session_data.picture,
                "plan": "free",
                "plan_price": 0,
                "created_at": datetime.now(timezone.utc),
                "is_admin": (session_data.email == "ekon75@hotmail.com"),
                "onboarding_step": 0
            }
            await db.users.insert_one(user)
        else:
            # Update existing user's name/picture if changed
            await db.users.update_one(
                {"email": session_data.email},
                {"$set": {
                    "name": session_data.name,
                    "picture": session_data.picture,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            # Refresh user data
            user = await db.users.find_one({"email": session_data.email}, {"_id": 0})
        
        # Store session in database
        await db.user_sessions.update_one(
            {"user_id": user["id"]},
            {"$set": {
                "user_id": user["id"],
                "session_token": session_data.session_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
        
        # Set httpOnly cookie with session token
        response.set_cookie(
            key="session_token",
            value=session_data.session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        return {
            "status": "success",
            "user": {
                "id": user.get("id"),
                "user_id": user.get("id"),
                "email": user.get("email"),
                "name": user.get("name"),
                "onboarding_step": user.get("onboarding_step", 0),
                "plan": user.get("plan", "free")
            }
        }
        
    except Exception as e:
        print(f"Emergent session error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# Auth/me endpoint - verify session and get user
@app.get("/api/auth/me")
async def auth_me(request: Request, authorization: str = Header(None)):
    """Get current user from session cookie or Authorization header"""
    db = get_database()
    
    # Try session cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token and authorization:
        session_token = authorization.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check session in database
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    
    if not user:
        # Try finding by old id format
        user = await db.users.find_one({"email": "ekon75@hotmail.com"}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return {
        "id": user.get("id"),
        "user_id": user.get("id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "onboarding_step": user.get("onboarding_step", 0),
        "plan": user.get("plan", "free"),
        "is_admin": user.get("is_admin", False)
    }

# Logout endpoint
@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user - clear session"""
    db = get_database()
    
    session_token = request.cookies.get("session_token")
    
    if session_token:
        # Delete session from database
        await db.user_sessions.delete_one({"session_token": session_token})
    
    # Clear cookie
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"status": "success", "message": "Logged out"}

# Admin endpoint to reset onboarding (temporary)
@app.post("/api/admin/reset-onboarding")
async def reset_onboarding(request: Request):
    """Reset user's onboarding step to 0"""
    db = get_database()
    
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Reset onboarding
    result = await db.users.update_one(
        {"id": session["user_id"]},
        {"$set": {"onboarding_step": 0}}
    )
    
    # Also try by email for old users
    if result.modified_count == 0:
        await db.users.update_one(
            {"email": "ekon75@hotmail.com"},
            {"$set": {"onboarding_step": 0}}
        )
    
    return {"status": "success", "message": "Onboarding reset to step 0"}

# Google OAuth endpoints
@app.post("/api/auth/google/callback")
async def google_oauth_callback(auth_data: GoogleAuthRequest):
    """Handle Google OAuth callback"""
    try:
        # Exchange code for token
        token_url = "https://oauth2.googleapis.com/token"
        
        # Use redirect_uri from environment variable
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "https://reels-estate.app/auth/google/callback")
        
        token_data = {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "code": auth_data.code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)
            token_json = token_response.json()
            
            if "access_token" not in token_json:
                # Return FULL error from Google so we can debug
                raise HTTPException(
                    status_code=400, 
                    detail={
                        "error": "Google token exchange failed",
                        "google_response": token_json,
                        "redirect_uri_used": redirect_uri,
                        "client_id_prefix": os.getenv("GOOGLE_CLIENT_ID", "")[:20] + "..."
                    }
                )
            
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
async def get_business_info(request: Request, authorization: str = Header(None)):
    """Get business information"""
    user = await get_current_user(request, authorization)
    
    business_info = user.get("business_info", {})
    return business_info

@app.post("/api/business-info")
async def save_business_info(request: Request, business_info: BusinessInfoRequest, authorization: str = Header(None)):
    """Save business information"""
    user = await get_current_user(request, authorization)
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
async def update_onboarding_progress(request: Request, progress: OnboardingProgressRequest, authorization: str = Header(None)):
    """Update onboarding progress"""
    user = await get_current_user(request, authorization)
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
async def get_onboarding_progress(request: Request, authorization: str = Header(None)):
    """Get onboarding progress"""
    user = await get_current_user(request, authorization)
    
    return {
        "current_step": user.get("onboarding_step", 0),
        "completed_steps": user.get("onboarding_completed_steps", {})
    }

# File upload endpoints
@app.post("/api/upload/logo")
async def upload_logo(request: Request, file: UploadFile = File(...), authorization: str = Header(None)):
    """Upload company logo - stores as base64 in database"""
    user = await get_current_user(request, authorization)
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PNG, JPG, and SVG are allowed")
    
    # Read file and convert to base64
    import base64
    file_content = await file.read()
    base64_data = base64.b64encode(file_content).decode('utf-8')
    
    # Create data URL
    logo_url = f"data:{file.content_type};base64,{base64_data}"
    
    # Store in database
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
async def get_branding(request: Request, authorization: str = Header(None)):
    """Get user branding information"""
    user = await get_current_user(request, authorization)
    
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
async def save_branding(request: Request, branding: BrandingRequest, authorization: str = Header(None)):
    """Save user branding preferences"""
    user = await get_current_user(request, authorization)
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
async def get_facebook_auth_url(request: Request, authorization: str = Header(None)):
    """Generate Facebook OAuth URL"""
    user = await get_current_user(request, authorization)
    
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
async def get_instagram_accounts(request: Request, authorization: str = Header(None)):
    """Get Instagram Business accounts linked to user's Facebook Pages"""
    user = await get_current_user(request, authorization)
    
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
    request: Request,
    ig_account_id: str,
    username: str,
    facebook_page_id: str,
    page_access_token: str,
    authorization: str = Header(None)
):
    """Store Instagram account connection"""
    user = await get_current_user(request, authorization)
    
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
async def get_social_media_connections(request: Request, authorization: str = Header(None)):
    """Get user's social media connections"""
    user = await get_current_user(request, authorization)
    
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
async def disconnect_social_media(http_request: Request, request: DisconnectRequest, authorization: str = Header(None)):
    """Disconnect a social media platform"""
    user = await get_current_user(http_request, authorization)
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
async def get_facebook_status(request: Request, authorization: str = Header(None)):
    """Check Facebook connection status"""
    user = await get_current_user(request, authorization)
    return {"connected": user.get("facebook_connected", False)}

@app.get("/api/auth/instagram/status")
async def get_instagram_status(request: Request, authorization: str = Header(None)):
    """Check Instagram connection status"""
    user = await get_current_user(request, authorization)
    return {"connected": user.get("instagram_connected", False)}

@app.get("/api/auth/youtube/status")
async def get_youtube_status(request: Request, authorization: str = Header(None)):
    """Check YouTube connection status"""
    user = await get_current_user(request, authorization)
    return {"connected": user.get("youtube_connected", False)}

@app.get("/api/auth/linkedin/status")
async def get_linkedin_status(request: Request, authorization: str = Header(None)):
    """Check LinkedIn connection status"""
    user = await get_current_user(request, authorization)
    return {"connected": user.get("linkedin_connected", False)}

@app.get("/api/auth/tiktok/status")
async def get_tiktok_status(request: Request, authorization: str = Header(None)):
    """Check TikTok connection status"""
    user = await get_current_user(request, authorization)
    return {"connected": user.get("tiktok_connected", False)}

@app.delete("/api/auth/{platform}/disconnect")
async def disconnect_platform(request: Request, platform: str, authorization: str = Header(None)):
    """Disconnect a social media platform"""
    user = await get_current_user(request, authorization)
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
async def get_platform_auth_url(request: Request, platform: str, authorization: str = Header(None)):
    """Get OAuth authorization URL for a platform"""
    user = await get_current_user(request, authorization)
    
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
async def get_youtube_auth_url(request: Request, authorization: str = Header(None)):
    """Generate YouTube OAuth URL"""
    user = await get_current_user(request, authorization)
    
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
async def get_tiktok_auth_url(request: Request, authorization: str = Header(None)):
    """Generate TikTok OAuth URL"""
    user = await get_current_user(request, authorization)
    
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
async def get_linkedin_auth_url(request: Request, authorization: str = Header(None)):
    """Generate LinkedIn OAuth URL"""
    user = await get_current_user(request, authorization)
    
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
async def get_linkedin_pages(request: Request, authorization: str = Header(None)):
    """Get LinkedIn pages for user (personal profile and organization pages)"""
    user = await get_current_user(request, authorization)
    
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
    user = await get_current_user(request, authorization)
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
async def get_agents(request: Request, authorization: str = Header(None)):
    """Get all agents for the user"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    agents = await db.agents.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return agents

@app.post("/api/agents")
async def add_agent(request: Request, agent: dict, authorization: str = Header(None)):
    """Add a new agent"""
    user = await get_current_user(request, authorization)
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
async def update_agent(request: Request, agent_id: str, agent: dict, authorization: str = Header(None)):
    """Update an existing agent"""
    user = await get_current_user(request, authorization)
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
async def delete_agent(request: Request, agent_id: str, authorization: str = Header(None)):
    """Delete an agent"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Verify agent belongs to user
    existing_agent = await db.agents.find_one({"id": agent_id, "user_id": user["id"]})
    if not existing_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await db.agents.delete_one({"id": agent_id, "user_id": user["id"]})
    
    return {"status": "success", "message": "Agent deleted"}

@app.post("/api/upload/agent-photo")
async def upload_agent_photo(request: Request, file: UploadFile = File(...), authorization: str = Header(None)):
    """Upload agent photo - stores as base64 in database"""
    user = await get_current_user(request, authorization)
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PNG and JPG are allowed")
    
    # Read file and convert to base64
    import base64
    file_content = await file.read()
    base64_data = base64.b64encode(file_content).decode('utf-8')
    
    # Create data URL
    photo_url = f"data:{file.content_type};base64,{base64_data}"
    
    return {"status": "success", "photo_url": photo_url}

# Subscription management endpoints
class SubscriptionRequest(BaseModel):
    plan_name: str
    plan_price: float

@app.post("/api/subscription")
async def activate_subscription(request: Request, subscription: SubscriptionRequest, authorization: str = Header(None)):
    """Activate a subscription plan"""
    user = await get_current_user(request, authorization)
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
async def get_subscription(request: Request, authorization: str = Header(None)):
    """Get user's current subscription"""
    user = await get_current_user(request, authorization)
    
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
async def get_billing(request: Request, authorization: str = Header(None)):
    """Get user's billing information"""
    user = await get_current_user(request, authorization)
    
    billing_info = user.get("billing_info", {})
    return {
        "vat_number": billing_info.get("vat_number", ""),
        "billing_address": billing_info.get("billing_address", ""),
        "payment_method": billing_info.get("payment_method", ""),
        "saved_cards": billing_info.get("saved_cards", "[]")
    }

@app.post("/api/billing")
async def save_billing(request: Request, billing: BillingRequest, authorization: str = Header(None)):
    """Save user's billing information"""
    user = await get_current_user(request, authorization)
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
async def cancel_subscription(request: Request, authorization: str = Header(None)):
    """Cancel user's subscription"""
    user = await get_current_user(request, authorization)
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
    user = await get_current_user(request, authorization)
    
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
    user = await get_current_user(request, authorization)
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

# ============================================
# STRIPE PAYMENT ENDPOINTS
# ============================================

class CreateCheckoutRequest(BaseModel):
    plan_id: str  # "basic", "professional", "enterprise", "ai_caption"
    origin_url: str  # Frontend origin URL

@app.post("/api/stripe/create-checkout")
async def create_stripe_checkout(request: Request, checkout_data: CreateCheckoutRequest, authorization: str = Header(None)):
    """Create a Stripe checkout session for subscription"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Validate plan
    if checkout_data.plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan selected")
    
    plan = SUBSCRIPTION_PLANS[checkout_data.plan_id]
    
    # Initialize Stripe with official SDK
    api_key = os.getenv("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = api_key
    
    # Build URLs from frontend origin - use dedicated payment success page
    success_url = f"{checkout_data.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&status=success"
    cancel_url = f"{checkout_data.origin_url}/payment/success?status=cancelled"
    
    try:
        # Create Stripe checkout session using official SDK
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": plan["currency"],
                    "unit_amount": int(plan["price"] * 100),  # Convert to cents
                    "product_data": {
                        "name": f"ReelsEstate {plan['name']} Plan",
                        "description": f"Monthly subscription to {plan['name']} plan"
                    }
                },
                "quantity": 1
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user["id"],
                "user_email": user["email"],
                "plan_id": checkout_data.plan_id,
                "plan_name": plan["name"]
            }
        )
        
        # Create payment transaction record
        transaction = {
            "id": str(ObjectId()),
            "session_id": session.id,
            "user_id": user["id"],
            "user_email": user["email"],
            "plan_id": checkout_data.plan_id,
            "plan_name": plan["name"],
            "amount": plan["price"],
            "currency": plan["currency"],
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url,
            "session_id": session.id
        }
        
    except stripe.error.StripeError as e:
        print(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")
    except Exception as e:
        print(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@app.get("/api/stripe/checkout-status/{session_id}")
async def get_stripe_checkout_status(request: Request, session_id: str, authorization: str = Header(None)):
    """Get the status of a Stripe checkout session - works without auth for post-redirect"""
    db = get_database()
    
    # Find transaction by session_id (no user verification needed - session_id is secret enough)
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return cached status
    if transaction.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "plan_name": transaction.get("plan_name"),
            "amount": transaction.get("amount"),
            "currency": transaction.get("currency"),
            "user_id": transaction.get("user_id")
        }
    
    # Check with Stripe using official SDK
    api_key = os.getenv("STRIPE_API_KEY")
    stripe.api_key = api_key
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Determine payment status
        payment_status = "pending"
        if session.payment_status == "paid":
            payment_status = "paid"
        elif session.status == "expired":
            payment_status = "expired"
        
        # Update transaction status
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": payment_status,
                "stripe_status": session.status,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # If payment successful, activate subscription using user_id from transaction
        if payment_status == "paid":
            user_id = transaction.get("user_id")
            plan_id = transaction.get("plan_id")
            plan = SUBSCRIPTION_PLANS.get(plan_id, {})
            
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "plan": plan.get("name", "Basic"),
                    "plan_price": plan.get("price", 0),
                    "subscription_status": "active",
                    "trial_active": False,
                    "subscription_activated_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        
        return {
            "status": session.status,
            "payment_status": payment_status,
            "amount": session.amount_total / 100 if session.amount_total else 0,  # Convert from cents
            "currency": session.currency,
            "plan_name": transaction.get("plan_name")
        }
        
    except stripe.error.StripeError as e:
        print(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")
    except Exception as e:
        print(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")

@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        api_key = os.getenv("STRIPE_API_KEY")
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        stripe.api_key = api_key
        
        db = get_database()
        
        # If webhook secret is configured, verify signature
        if webhook_secret and signature:
            try:
                event = stripe.Webhook.construct_event(
                    body, signature, webhook_secret
                )
            except stripe.error.SignatureVerificationError as e:
                print(f"Webhook signature verification failed: {e}")
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            # Parse event without verification (for testing)
            import json
            event = json.loads(body)
        
        # Handle the event
        event_type = event.get("type") if isinstance(event, dict) else event.type
        event_data = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
        
        if event_type == "checkout.session.completed":
            session_id = event_data.get("id") if isinstance(event_data, dict) else event_data.id
            payment_status = event_data.get("payment_status") if isinstance(event_data, dict) else event_data.payment_status
            
            # Find the transaction
            transaction = await db.payment_transactions.find_one(
                {"session_id": session_id},
                {"_id": 0}
            )
            
            if transaction:
                # Update transaction status
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid" if payment_status == "paid" else payment_status,
                        "event_type": event_type,
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
                
                # If payment completed, activate subscription
                if payment_status == "paid":
                    user_id = transaction.get("user_id")
                    plan_id = transaction.get("plan_id")
                    plan = SUBSCRIPTION_PLANS.get(plan_id, {})
                    
                    await db.users.update_one(
                        {"id": user_id},
                        {"$set": {
                            "plan": plan.get("name", "Basic"),
                            "plan_price": plan.get("price", 0),
                            "subscription_status": "active",
                            "trial_active": False,
                            "subscription_activated_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc)
                        }}
                    )
        
        return {"status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/stripe/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return {
        "plans": [
            {
                "id": "basic",
                "name": "Basic",
                "price": 19.99,
                "currency": "EUR",
                "features": [
                    "5 video creaties per maand",
                    "Basis templates",
                    "Email support"
                ]
            },
            {
                "id": "professional",
                "name": "Professional",
                "price": 39.99,
                "currency": "EUR",
                "features": [
                    "20 video creaties per maand",
                    "Alle templates",
                    "Priority support",
                    "Custom branding"
                ]
            },
            {
                "id": "enterprise",
                "name": "Enterprise",
                "price": 99.99,
                "currency": "EUR",
                "features": [
                    "Onbeperkt video creaties",
                    "Alle premium templates",
                    "24/7 Priority support",
                    "Custom branding",
                    "Analytics dashboard",
                    "Dedicated account manager"
                ]
            },
            {
                "id": "ai_caption",
                "name": "AI Caption",
                "price": 199.99,
                "currency": "EUR",
                "features": [
                    "Alles in Enterprise",
                    "AI-gegenereerde captions",
                    "Automatische ondertiteling",
                    "Multi-language support",
                    "Advanced AI features"
                ]
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))

# ============================================
# PROJECT MANAGEMENT ENDPOINTS
# ============================================

class ProjectCreate(BaseModel):
    title: str
    status: str = "draft"

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    agent_id: Optional[str] = None
    left_banner: Optional[str] = None
    right_banner_price: Optional[str] = None
    currency: Optional[str] = None
    music_track: Optional[str] = None

@app.get("/api/projects")
async def get_projects(request: Request, authorization: str = Header(None)):
    """Get all projects for the current user"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    projects = await db.projects.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return projects

@app.post("/api/projects")
async def create_project(request: Request, project: ProjectCreate, authorization: str = Header(None)):
    """Create a new project"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    project_data = {
        "id": str(ObjectId()),
        "user_id": user["id"],
        "title": project.title,
        "status": project.status,
        "photos": [],
        "photo_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.insert_one(project_data)
    
    return {"id": project_data["id"], "status": "success", "message": "Project created"}

@app.get("/api/projects/{project_id}")
async def get_project(request: Request, project_id: str, authorization: str = Header(None)):
    """Get a specific project"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    project = await db.projects.find_one(
        {"id": project_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project

@app.put("/api/projects/{project_id}")
async def update_project(request: Request, project_id: str, project: ProjectUpdate, authorization: str = Header(None)):
    """Update a project"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Build update dict with only provided fields
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field, value in project.dict(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value
    
    result = await db.projects.update_one(
        {"id": project_id, "user_id": user["id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"status": "success", "message": "Project updated"}

@app.delete("/api/projects/{project_id}")
async def delete_project(request: Request, project_id: str, authorization: str = Header(None)):
    """Delete a project"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    result = await db.projects.delete_one({"id": project_id, "user_id": user["id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Also delete associated photos and videos
    await db.project_photos.delete_many({"project_id": project_id})
    await db.project_videos.delete_many({"project_id": project_id})
    
    return {"status": "success", "message": "Project deleted"}

# ============================================
# PROJECT PHOTOS ENDPOINTS
# ============================================

@app.post("/api/projects/{project_id}/photos")
async def upload_project_photo(
    request: Request,
    project_id: str,
    file: UploadFile = File(...),
    position: int = 0,
    caption: str = "",
    authorization: str = Header(None)
):
    """Upload a photo to a project"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Verify project belongs to user
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Read file and convert to base64
    import base64
    file_content = await file.read()
    base64_data = base64.b64encode(file_content).decode('utf-8')
    
    photo_id = str(ObjectId())
    photo_url = f"data:{file.content_type};base64,{base64_data}"
    
    photo_data = {
        "id": photo_id,
        "project_id": project_id,
        "original_url": photo_url,
        "enhanced_url": None,
        "enhanced": False,
        "position": position,
        "caption": caption,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to project's photos array
    await db.projects.update_one(
        {"id": project_id},
        {
            "$push": {"photos": photo_data},
            "$inc": {"photo_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"status": "success", "photo_id": photo_id, "url": photo_url}

@app.put("/api/projects/{project_id}/photos/{photo_id}")
async def update_project_photo(
    request: Request,
    project_id: str,
    photo_id: str,
    update: dict,
    authorization: str = Header(None)
):
    """Update a photo's caption or position"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Build the update query for the specific photo in the array
    update_fields = {}
    if "caption" in update:
        update_fields["photos.$.caption"] = update["caption"]
    if "position" in update:
        update_fields["photos.$.position"] = update["position"]
    
    if update_fields:
        await db.projects.update_one(
            {"id": project_id, "user_id": user["id"], "photos.id": photo_id},
            {"$set": update_fields}
        )
    
    return {"status": "success", "message": "Photo updated"}

@app.delete("/api/projects/{project_id}/photos/{photo_id}")
async def delete_project_photo(
    request: Request,
    project_id: str,
    photo_id: str,
    authorization: str = Header(None)
):
    """Delete a photo from a project"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    await db.projects.update_one(
        {"id": project_id, "user_id": user["id"]},
        {
            "$pull": {"photos": {"id": photo_id}},
            "$inc": {"photo_count": -1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"status": "success", "message": "Photo deleted"}

@app.post("/api/projects/{project_id}/photos/{photo_id}/enhance")
async def enhance_project_photo(
    request: Request,
    project_id: str,
    photo_id: str,
    enhancement_type: str = "auto",
    authorization: str = Header(None)
):
    """Enhance a photo with real image processing"""
    import base64
    from PIL import Image, ImageEnhance, ImageFilter
    import io
    
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Get the project and find the photo
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Find the specific photo
    photo = None
    for p in project.get("photos", []):
        if p["id"] == photo_id:
            photo = p
            break
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Get original image data
    original_url = photo.get("original_url", "")
    if not original_url.startswith("data:"):
        raise HTTPException(status_code=400, detail="Invalid image format")
    
    try:
        # Extract base64 data
        header, base64_data = original_url.split(",", 1)
        image_data = base64.b64decode(base64_data)
        
        # Open image with PIL
        img = Image.open(io.BytesIO(image_data))
        img = img.convert("RGB")
        
        # Apply enhancement based on type
        if enhancement_type == "auto":
            # Balanced enhancement
            img = ImageEnhance.Brightness(img).enhance(1.1)
            img = ImageEnhance.Contrast(img).enhance(1.15)
            img = ImageEnhance.Color(img).enhance(1.1)
            img = ImageEnhance.Sharpness(img).enhance(1.2)
        elif enhancement_type == "vibrant":
            # High saturation
            img = ImageEnhance.Color(img).enhance(1.4)
            img = ImageEnhance.Contrast(img).enhance(1.2)
            img = ImageEnhance.Brightness(img).enhance(1.05)
        elif enhancement_type == "natural":
            # Subtle improvements
            img = ImageEnhance.Brightness(img).enhance(1.05)
            img = ImageEnhance.Contrast(img).enhance(1.08)
            img = ImageEnhance.Sharpness(img).enhance(1.1)
        elif enhancement_type == "hdr":
            # HDR-like effect
            img = ImageEnhance.Contrast(img).enhance(1.3)
            img = ImageEnhance.Brightness(img).enhance(1.1)
            img = ImageEnhance.Color(img).enhance(1.15)
            img = ImageEnhance.Sharpness(img).enhance(1.3)
        elif enhancement_type == "warm":
            # Warm tones - increase red/yellow
            img = ImageEnhance.Color(img).enhance(1.15)
            # Apply slight warm filter by adjusting channels
            r, g, b = img.split()
            r = r.point(lambda x: min(255, int(x * 1.1)))
            b = b.point(lambda x: int(x * 0.95))
            img = Image.merge("RGB", (r, g, b))
            img = ImageEnhance.Brightness(img).enhance(1.05)
        elif enhancement_type == "cool":
            # Cool tones - increase blue
            img = ImageEnhance.Color(img).enhance(1.1)
            r, g, b = img.split()
            r = r.point(lambda x: int(x * 0.95))
            b = b.point(lambda x: min(255, int(x * 1.1)))
            img = Image.merge("RGB", (r, g, b))
            img = ImageEnhance.Contrast(img).enhance(1.1)
        elif enhancement_type == "clarity":
            # Maximum sharpness
            img = ImageEnhance.Sharpness(img).enhance(2.0)
            img = ImageEnhance.Contrast(img).enhance(1.2)
            img = img.filter(ImageFilter.EDGE_ENHANCE)
        
        # Save enhanced image to base64
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=95)
        enhanced_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        enhanced_url = f"data:image/jpeg;base64,{enhanced_base64}"
        
        # Update the photo in database
        await db.projects.update_one(
            {"id": project_id, "user_id": user["id"], "photos.id": photo_id},
            {"$set": {
                "photos.$.enhanced": True,
                "photos.$.enhanced_url": enhanced_url,
                "photos.$.enhancement_type": enhancement_type
            }}
        )
        
        return {"status": "success", "message": f"Photo enhanced with {enhancement_type}"}
        
    except Exception as e:
        print(f"Enhancement error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Enhancement failed: {str(e)}")

@app.post("/api/projects/{project_id}/photos/{photo_id}/undo-enhance")
async def undo_enhance_photo(
    request: Request,
    project_id: str,
    photo_id: str,
    authorization: str = Header(None)
):
    """Undo photo enhancement"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    await db.projects.update_one(
        {"id": project_id, "user_id": user["id"], "photos.id": photo_id},
        {"$set": {
            "photos.$.enhanced": False,
            "photos.$.enhanced_url": None,
            "photos.$.caption": ""
        }}
    )
    
    return {"status": "success", "message": "Enhancement removed"}

# ============================================
# PROJECT MUSIC ENDPOINT
# ============================================

@app.post("/api/projects/{project_id}/upload-music")
async def upload_project_music(
    request: Request,
    project_id: str,
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """Upload music to a project"""
    import base64
    
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Verify project belongs to user
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Read file and convert to base64
    file_content = await file.read()
    base64_data = base64.b64encode(file_content).decode('utf-8')
    
    music_url = f"data:{file.content_type};base64,{base64_data}"
    
    # Update project with music URL
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "music_url": music_url,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success", "music_url": music_url}

# ============================================
# PROJECT VIDEOS ENDPOINTS
# ============================================

@app.get("/api/projects/{project_id}/videos")
async def get_project_videos(request: Request, project_id: str, authorization: str = Header(None)):
    """Get all videos for a project"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Verify project belongs to user
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    videos = await db.project_videos.find(
        {"project_id": project_id},
        {"_id": 0}
    ).to_list(100)
    
    return videos

@app.post("/api/projects/{project_id}/generate-video")
async def generate_project_video(
    request: Request,
    project_id: str,
    format_type: str = "16:9",
    authorization: str = Header(None)
):
    """Generate a professional video with intro, Ken Burns effect, and outro"""
    import base64
    import tempfile
    import os as os_module
    import random
    from moviepy import ImageClip, concatenate_videoclips, TextClip, CompositeVideoClip, ColorClip
    from PIL import Image, ImageDraw, ImageFont
    import io
    
    user = await get_current_user(request, authorization)
    db = get_database()
    
    # Get project with all details
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    photos = project.get("photos", [])
    if not photos or len(photos) == 0:
        raise HTTPException(status_code=400, detail="Project has no photos")
    
    # Get branding info for intro/outro
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    branding = user_data.get("branding", {}) if user_data else {}
    main_color = branding.get("main_color", "#FF6B35")
    
    # Get agent info if configured
    agent_id = project.get("agent_id")
    agent = None
    if agent_id and user_data:
        agents = user_data.get("agents", [])
        for a in agents:
            if a.get("id") == agent_id:
                agent = a
                break
    
    # Determine video dimensions based on format - use lower resolution for smaller file size
    if format_type == "16:9":
        width, height = 854, 480  # 480p for smaller file size
    elif format_type == "9:16":
        width, height = 480, 854
    elif format_type == "1:1":
        width, height = 480, 480
    else:
        width, height = 854, 480
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            all_clips = []
            duration_per_photo = 3  # seconds per photo (shorter for smaller file)
            
            # === CREATE INTRO ===
            intro_img = Image.new('RGB', (width, height), color=main_color)
            draw = ImageDraw.Draw(intro_img)
            
            # Add title text
            title = project.get("title", "Property Tour")
            
            # Calculate text position (center)
            try:
                font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
                font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
            except:
                font_large = ImageFont.load_default()
                font_small = ImageFont.load_default()
            
            # Draw title
            bbox = draw.textbbox((0, 0), title, font=font_large)
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            y = height // 2 - 50
            draw.text((x, y), title, fill="white", font=font_large)
            
            # Draw subtitle if banner exists
            left_banner = project.get("left_banner", "")
            if left_banner and left_banner != "No Banner":
                bbox2 = draw.textbbox((0, 0), left_banner, font=font_small)
                text_width2 = bbox2[2] - bbox2[0]
                x2 = (width - text_width2) // 2
                draw.text((x2, y + 80), left_banner, fill="white", font=font_small)
            
            intro_path = os_module.path.join(temp_dir, "intro.jpg")
            intro_img.save(intro_path, "JPEG", quality=95)
            intro_clip = ImageClip(intro_path, duration=2)
            all_clips.append(intro_clip)
            
            # === PROCESS PHOTOS WITH KEN BURNS EFFECT ===
            def create_ken_burns_clip(img_path, duration, width, height, effect_type):
                """Create a clip with Ken Burns (pan/zoom) effect"""
                clip = ImageClip(img_path, duration=duration)
                
                # Random zoom direction
                if effect_type == 0:
                    # Zoom in from center
                    clip = clip.resized(lambda t: 1 + 0.1 * t / duration)
                elif effect_type == 1:
                    # Zoom out from center
                    clip = clip.resized(lambda t: 1.1 - 0.1 * t / duration)
                elif effect_type == 2:
                    # Slight zoom in
                    clip = clip.resized(lambda t: 1 + 0.05 * t / duration)
                else:
                    # Slight zoom out
                    clip = clip.resized(lambda t: 1.05 - 0.05 * t / duration)
                
                # Center the clip
                clip = clip.with_position('center')
                
                # Create a container clip
                container = ColorClip(size=(width, height), color=(0, 0, 0), duration=duration)
                final = CompositeVideoClip([container, clip], size=(width, height))
                
                return final
            
            for i, photo in enumerate(photos):
                photo_url = photo.get("enhanced_url") or photo.get("original_url")
                
                if not photo_url or not photo_url.startswith("data:"):
                    continue
                
                # Extract and save image
                header, base64_data = photo_url.split(",", 1)
                image_data = base64.b64decode(base64_data)
                
                temp_image_path = os_module.path.join(temp_dir, f"photo_{i}.jpg")
                with open(temp_image_path, "wb") as f:
                    f.write(image_data)
                
                # Open and resize image
                img = Image.open(temp_image_path)
                img = img.convert("RGB")
                
                # Resize to slightly larger than video (for zoom effect)
                zoom_size = (int(width * 1.2), int(height * 1.2))
                
                # Calculate crop to fit
                img_ratio = img.width / img.height
                target_ratio = zoom_size[0] / zoom_size[1]
                
                if img_ratio > target_ratio:
                    new_height = img.height
                    new_width = int(new_height * target_ratio)
                    left = (img.width - new_width) // 2
                    img = img.crop((left, 0, left + new_width, new_height))
                else:
                    new_width = img.width
                    new_height = int(new_width / target_ratio)
                    top = (img.height - new_height) // 2
                    img = img.crop((0, top, new_width, top + new_height))
                
                img = img.resize(zoom_size, Image.LANCZOS)
                
                resized_path = os_module.path.join(temp_dir, f"resized_{i}.jpg")
                img.save(resized_path, "JPEG", quality=95)
                
                # Create clip with Ken Burns effect
                effect_type = i % 4  # Alternate between different effects
                photo_clip = create_ken_burns_clip(resized_path, duration_per_photo, width, height, effect_type)
                all_clips.append(photo_clip)
            
            # === CREATE OUTRO ===
            outro_img = Image.new('RGB', (width, height), color=main_color)
            draw = ImageDraw.Draw(outro_img)
            
            # Add agent info or generic outro
            if agent:
                agent_name = agent.get("name", "")
                agent_phone = agent.get("phone", "")
                agent_email = agent.get("email", "")
                
                y_pos = height // 2 - 80
                
                if agent_name:
                    bbox = draw.textbbox((0, 0), agent_name, font=font_large)
                    x = (width - (bbox[2] - bbox[0])) // 2
                    draw.text((x, y_pos), agent_name, fill="white", font=font_large)
                    y_pos += 70
                
                if agent_phone:
                    bbox = draw.textbbox((0, 0), agent_phone, font=font_small)
                    x = (width - (bbox[2] - bbox[0])) // 2
                    draw.text((x, y_pos), agent_phone, fill="white", font=font_small)
                    y_pos += 40
                
                if agent_email:
                    bbox = draw.textbbox((0, 0), agent_email, font=font_small)
                    x = (width - (bbox[2] - bbox[0])) // 2
                    draw.text((x, y_pos), agent_email, fill="white", font=font_small)
            else:
                # Generic outro
                text = "Thank you for watching"
                bbox = draw.textbbox((0, 0), text, font=font_large)
                x = (width - (bbox[2] - bbox[0])) // 2
                draw.text((x, height // 2 - 30), text, fill="white", font=font_large)
            
            outro_path = os_module.path.join(temp_dir, "outro.jpg")
            outro_img.save(outro_path, "JPEG", quality=95)
            outro_clip = ImageClip(outro_path, duration=2)
            all_clips.append(outro_clip)
            
            # === CONCATENATE ALL CLIPS ===
            if len(all_clips) < 2:
                raise HTTPException(status_code=400, detail="Not enough content to generate video")
            
            final_clip = concatenate_videoclips(all_clips, method="compose")
            
            # Generate output
            video_id = str(ObjectId())
            output_path = os_module.path.join(temp_dir, f"output_{video_id}.mp4")
            
            final_clip.write_videofile(
                output_path,
                fps=15,
                codec="libx264",
                audio=False,
                preset="ultrafast",
                bitrate="500k"
            )
            
            # Close all clips
            for clip in all_clips:
                clip.close()
            final_clip.close()
            
            # Read and convert to base64
            with open(output_path, "rb") as f:
                video_bytes = f.read()
            video_base64 = base64.b64encode(video_bytes).decode('utf-8')
            video_data_url = f"data:video/mp4;base64,{video_base64}"
            
            # Save to database
            video_data = {
                "id": video_id,
                "project_id": project_id,
                "user_id": user["id"],
                "format": format_type,
                "status": "completed",
                "file_url": video_data_url,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.project_videos.insert_one(video_data)
            
            return {
                "status": "success", 
                "video_id": video_id, 
                "message": "Video generated successfully"
            }
            
    except Exception as e:
        print(f"Video generation error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")

