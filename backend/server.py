from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
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
import io

# Stripe integration - using official stripe library
import stripe

# Load environment variables
load_dotenv()

app = FastAPI(title="ReelsEstate API")

# Subscription plans - FIXED PRICES (never accept from frontend)
SUBSCRIPTION_PLANS = {
    "basic": {
        "name": "Basic", 
        "price": 19.99, 
        "currency": "eur",
        "max_quality": "sd",
        "features": [
            "5 video creaties per maand",
            "SD kwaliteit (480p)",
            "Basis templates",
            "Email support"
        ]
    },
    "professional": {
        "name": "Professional", 
        "price": 39.99, 
        "currency": "eur",
        "max_quality": "hd",
        "features": [
            "20 video creaties per maand",
            "HD kwaliteit (720p)",
            "Alle templates",
            "Priority support",
            "Custom branding"
        ]
    },
    "enterprise": {
        "name": "Enterprise", 
        "price": 99.99, 
        "currency": "eur",
        "max_quality": "fullhd",
        "features": [
            "Onbeperkt video creaties",
            "Full HD kwaliteit (1080p)",
            "Alle premium templates",
            "24/7 Priority support",
            "Custom branding",
            "Analytics dashboard"
        ]
    },
    "ai_caption": {
        "name": "AI Caption", 
        "price": 199.99, 
        "currency": "eur",
        "max_quality": "4k",
        "features": [
            "Alles in Enterprise",
            "4K Ultra HD kwaliteit (2160p)",
            "AI-gegenereerde captions",
            "Automatische ondertiteling",
            "Multi-language support",
            "Advanced AI features"
        ]
    }
}

# Quality levels hierarchy
QUALITY_LEVELS = {
    "sd": 1,
    "hd": 2,
    "fullhd": 3,
    "4k": 4
}

def get_max_quality_for_plan(plan_name: str) -> str:
    """Get the maximum allowed quality for a subscription plan"""
    plan_name_lower = plan_name.lower().replace(" ", "_")
    for plan_id, plan_data in SUBSCRIPTION_PLANS.items():
        if plan_id == plan_name_lower or plan_data["name"].lower() == plan_name.lower():
            return plan_data.get("max_quality", "sd")
    return "sd"  # Default to SD for unknown/trial plans

def is_quality_allowed(user_plan: str, requested_quality: str) -> bool:
    """Check if a quality level is allowed for a user's plan"""
    max_quality = get_max_quality_for_plan(user_plan)
    max_level = QUALITY_LEVELS.get(max_quality, 1)
    requested_level = QUALITY_LEVELS.get(requested_quality, 1)
    return requested_level <= max_level

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

_mongo_client = None

def get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(mongo_url)
    return _mongo_client

def get_database():
    client = get_mongo_client()
    return client[db_name]

def get_gridfs_bucket():
    """Get GridFS bucket for storing large files like videos"""
    client = get_mongo_client()
    db = client[db_name]
    return AsyncIOMotorGridFSBucket(db, bucket_name="videos")

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
    """Get available subscription plans with features"""
    return {
        "plans": [
            {
                "id": "basic",
                "name": "Basic",
                "price": 19.99,
                "currency": "EUR",
                "max_quality": "sd",
                "features": [
                    "5 video creaties per maand",
                    "SD kwaliteit (480p)",
                    "Basis templates",
                    "Email support"
                ]
            },
            {
                "id": "professional",
                "name": "Professional",
                "price": 39.99,
                "currency": "EUR",
                "max_quality": "hd",
                "features": [
                    "20 video creaties per maand",
                    "HD kwaliteit (720p)",
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
                "max_quality": "fullhd",
                "features": [
                    "Onbeperkt video creaties",
                    "Full HD kwaliteit (1080p)",
                    "Alle premium templates",
                    "24/7 Priority support",
                    "Custom branding",
                    "Analytics dashboard"
                ]
            },
            {
                "id": "ai_caption",
                "name": "AI Caption",
                "price": 199.99,
                "currency": "EUR",
                "max_quality": "4k",
                "features": [
                    "Alles in Enterprise",
                    "4K Ultra HD kwaliteit (2160p)",
                    "AI-gegenereerde captions",
                    "Automatische ondertiteling",
                    "Multi-language support",
                    "Advanced AI features"
                ]
            }
        ]
    }

# Endpoint to get user's allowed qualities based on their plan
@app.get("/api/user/allowed-qualities")
async def get_allowed_qualities(request: Request, authorization: str = Header(None)):
    """Get the quality options allowed for the current user's plan"""
    user = await get_current_user(request, authorization)
    db = get_database()
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    user_plan = user_data.get("plan", "Basic") if user_data else "Basic"
    max_quality = get_max_quality_for_plan(user_plan)
    max_level = QUALITY_LEVELS.get(max_quality, 1)
    
    all_qualities = [
        {"value": "sd", "label": "SD (480p)", "description": "Snel, klein bestand", "level": 1},
        {"value": "hd", "label": "HD (720p)", "description": "Goede kwaliteit", "level": 2},
        {"value": "fullhd", "label": "Full HD (1080p)", "description": "Hoge kwaliteit", "level": 3},
        {"value": "4k", "label": "4K (2160p)", "description": "Ultra HD, groot bestand", "level": 4}
    ]
    
    allowed_qualities = []
    for q in all_qualities:
        q_copy = q.copy()
        q_copy["allowed"] = q["level"] <= max_level
        q_copy["requires_upgrade"] = not q_copy["allowed"]
        allowed_qualities.append(q_copy)
    
    return {
        "user_plan": user_plan,
        "max_quality": max_quality,
        "qualities": allowed_qualities
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
# GRIDFS VIDEO STREAMING ENDPOINT
# ============================================

@app.get("/api/videos/{video_id}/stream")
async def stream_video(video_id: str):
    """Stream a video from GridFS"""
    try:
        fs = get_gridfs_bucket()
        
        # Find the file in GridFS
        cursor = fs.find({"metadata.video_id": video_id})
        file_doc = await cursor.to_list(length=1)
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="Video not found")
        
        file_id = file_doc[0]["_id"]
        filename = file_doc[0].get("filename", f"{video_id}.mp4")
        
        # Stream the file
        async def video_streamer():
            grid_out = await fs.open_download_stream(file_id)
            while True:
                chunk = await grid_out.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                yield chunk
        
        return StreamingResponse(
            video_streamer(),
            media_type="video/mp4",
            headers={
                "Content-Disposition": f"inline; filename={filename}",
                "Accept-Ranges": "bytes"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Video stream error: {e}")
        raise HTTPException(status_code=500, detail="Failed to stream video")

@app.get("/api/videos/{video_id}/download")
async def download_video(video_id: str):
    """Download a video from GridFS"""
    try:
        fs = get_gridfs_bucket()
        db = get_database()
        
        # Get video info from database
        video = await db.project_videos.find_one({"id": video_id}, {"_id": 0})
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Find the file in GridFS
        cursor = fs.find({"metadata.video_id": video_id})
        file_doc = await cursor.to_list(length=1)
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="Video file not found")
        
        file_id = file_doc[0]["_id"]
        
        # Read the entire file
        grid_out = await fs.open_download_stream(file_id)
        video_data = await grid_out.read()
        
        return Response(
            content=video_data,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f"attachment; filename=video_{video_id}.mp4"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Video download error: {e}")
        raise HTTPException(status_code=500, detail="Failed to download video")

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
    quality: str = "hd",  # sd, hd, fullhd, 4k
    authorization: str = Header(None)
):
    """Generate a professional video with intro, Ken Burns effect, and outro - stored in GridFS"""
    import base64
    import tempfile
    import os as os_module
    import io as io_module
    from moviepy import ImageClip, concatenate_videoclips, CompositeVideoClip, ColorClip
    from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
    
    user = await get_current_user(request, authorization)
    db = get_database()
    fs = get_gridfs_bucket()
    
    # Get user's subscription plan to check quality allowance
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    user_plan = user_data.get("plan", "Basic") if user_data else "Basic"
    
    # Validate quality against user's plan
    if not is_quality_allowed(user_plan, quality):
        max_quality = get_max_quality_for_plan(user_plan)
        quality_names = {"sd": "SD (480p)", "hd": "HD (720p)", "fullhd": "Full HD (1080p)", "4k": "4K (2160p)"}
        raise HTTPException(
            status_code=403, 
            detail=f"Je {user_plan} plan staat maximaal {quality_names.get(max_quality, 'SD')} toe. Upgrade je plan voor hogere kwaliteit."
        )
    
    # Get project with all details
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    photos = project.get("photos", [])
    if not photos or len(photos) == 0:
        raise HTTPException(status_code=400, detail="Project has no photos")
    
    # Get branding info for intro/outro - branding fields are stored directly on user document
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    # Get branding values directly from user document (not from a nested branding object)
    main_color = user_data.get("main_color", "#FF6B35") if user_data else "#FF6B35"
    logo_url_from_user = user_data.get("logo_url", "") if user_data else ""
    company_website = user_data.get("website", "") if user_data else ""
    
    # Convert hex color to RGB tuple
    def hex_to_rgb(hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    brand_rgb = hex_to_rgb(main_color)
    
    # Get agent info if configured - agents are in separate collection, not user document
    agent_id = project.get("agent_id")
    agent = None
    if agent_id:
        agent = await db.agents.find_one({"id": agent_id, "user_id": user["id"]}, {"_id": 0})
    
    # Determine video dimensions based on format and quality
    quality_settings = {
        "sd": {"16:9": (854, 480), "9:16": (480, 854), "1:1": (480, 480), "fps": 24, "bitrate": "1000k"},
        "hd": {"16:9": (1280, 720), "9:16": (720, 1280), "1:1": (720, 720), "fps": 30, "bitrate": "2500k"},
        "fullhd": {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080), "fps": 30, "bitrate": "5000k"},
        "4k": {"16:9": (3840, 2160), "9:16": (2160, 3840), "1:1": (2160, 2160), "fps": 30, "bitrate": "15000k"}
    }
    
    settings = quality_settings.get(quality, quality_settings["hd"])
    width, height = settings.get(format_type, settings["16:9"])
    fps = settings["fps"]
    bitrate = settings["bitrate"]
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            all_clips = []
            duration_per_photo = 4  # seconds per photo
            
            # Font sizes based on video dimensions - INCREASED for better visibility
            font_size_xlarge = max(48, int(height * 0.10))   # Extra large for title
            font_size_large = max(36, int(height * 0.08))    # Large for names, headers
            font_size_medium = max(28, int(height * 0.055))  # Medium for subtitles
            font_size_small = max(20, int(height * 0.038))   # Small for details
            font_size_banner = max(18, int(height * 0.032))  # Banner text
            
            try:
                font_xlarge = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size_xlarge)
                font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size_large)
                font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size_medium)
                font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size_small)
                font_banner = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size_banner)
            except:
                font_xlarge = ImageFont.load_default()
                font_large = ImageFont.load_default()
                font_medium = ImageFont.load_default()
                font_small = ImageFont.load_default()
                font_banner = ImageFont.load_default()
            
            # Get company logo from user document (stored directly on user, not in branding object)
            logo_url = logo_url_from_user
            logo_img = None
            if logo_url and logo_url.startswith("data:"):
                try:
                    header, logo_b64 = logo_url.split(",", 1)
                    logo_data = base64.b64decode(logo_b64)
                    logo_img = Image.open(io_module.BytesIO(logo_data)).convert("RGBA")
                except:
                    logo_img = None
            
            title = project.get("title", "Property Tour")
            left_banner = project.get("left_banner", "")
            right_banner_price = project.get("right_banner_price", "")
            currency = project.get("currency", "€")
            
            # Format price
            price_text = ""
            if right_banner_price:
                price_text = f"{currency} {right_banner_price}"
            
            is_vertical = format_type == "9:16"
            
            # === CREATE INTRO (5 seconds) - WHITE BACKGROUND ===
            intro_img = Image.new('RGB', (width, height), color=(255, 255, 255))
            draw_intro = ImageDraw.Draw(intro_img)
            
            # Logo at top center - larger size
            logo_y_top = int(height * 0.12)
            if logo_img:
                logo_max_w = int(width * 0.5)  # Increased from 0.4
                logo_max_h = int(height * 0.25)  # Increased from 0.2
                logo_ratio = min(logo_max_w / logo_img.width, logo_max_h / logo_img.height)
                logo_size = (int(logo_img.width * logo_ratio), int(logo_img.height * logo_ratio))
                logo_resized = logo_img.resize(logo_size, Image.LANCZOS)
                logo_x = (width - logo_size[0]) // 2
                intro_img.paste(logo_resized, (logo_x, logo_y_top), logo_resized if logo_resized.mode == 'RGBA' else None)
            
            # "presents" in the middle (centered) - using larger font
            presents_text = "presents"
            bbox_presents = draw_intro.textbbox((0, 0), presents_text, font=font_large)
            presents_w = bbox_presents[2] - bbox_presents[0]
            presents_h = bbox_presents[3] - bbox_presents[1]
            presents_x = (width - presents_w) // 2
            presents_y = int(height * 0.48)
            draw_intro.text((presents_x, presents_y), presents_text, fill=brand_rgb, font=font_large)
            
            # Title below presents - using XLARGE font for maximum visibility
            bbox_title = draw_intro.textbbox((0, 0), title, font=font_xlarge)
            title_w = bbox_title[2] - bbox_title[0]
            title_x = (width - title_w) // 2
            title_y = presents_y + presents_h + int(height * 0.06)
            draw_intro.text((title_x, title_y), title, fill=(50, 50, 50), font=font_xlarge)
            
            intro_path = os_module.path.join(temp_dir, "intro.jpg")
            intro_img.save(intro_path, "JPEG", quality=95)
            intro_clip = ImageClip(intro_path, duration=5)
            all_clips.append(intro_clip)
            
            # === PROCESS PHOTOS WITH KEN BURNS EFFECT ===
            def create_ken_burns_clip(img_path, duration, width, height, effect_type):
                """Create a clip with Ken Burns (pan/zoom) effect"""
                clip = ImageClip(img_path, duration=duration)
                
                # Get original image size (1.2x video size as set during resize)
                img_w = int(width * 1.2)
                img_h = int(height * 1.2)
                
                # Calculate center position for the image
                center_x = (width - img_w) / 2
                center_y = (height - img_h) / 2
                
                # Keep movements subtle to ensure image stays in frame
                # Since image is 20% larger, we have safe margin for small movements
                max_pan_x = width * 0.05  # 5% of video width - very subtle
                max_pan_y = height * 0.05  # 5% of video height - very subtle
                zoom_start = 1.0
                zoom_end = 1.06  # 6% zoom max
                
                # Simple, reliable Ken Burns effects - all centered properly
                if effect_type == 0:
                    # Zoom in slowly from center
                    clip = clip.resized(lambda t: zoom_start + (zoom_end - zoom_start) * t / duration)
                    clip = clip.with_position('center')
                    
                elif effect_type == 1:
                    # Zoom out slowly to center
                    clip = clip.resized(lambda t: zoom_end - (zoom_end - zoom_start) * t / duration)
                    clip = clip.with_position('center')
                    
                elif effect_type == 2:
                    # Slow pan left to right - no zoom
                    def pos_lr(t):
                        x = center_x - max_pan_x + (max_pan_x * 2) * t / duration
                        return (x, center_y)
                    clip = clip.with_position(pos_lr)
                    
                elif effect_type == 3:
                    # Slow pan right to left - no zoom
                    def pos_rl(t):
                        x = center_x + max_pan_x - (max_pan_x * 2) * t / duration
                        return (x, center_y)
                    clip = clip.with_position(pos_rl)
                    
                elif effect_type == 4:
                    # Slow pan top to bottom - no zoom
                    def pos_tb(t):
                        y = center_y - max_pan_y + (max_pan_y * 2) * t / duration
                        return (center_x, y)
                    clip = clip.with_position(pos_tb)
                    
                elif effect_type == 5:
                    # Slow pan bottom to top - no zoom
                    def pos_bt(t):
                        y = center_y + max_pan_y - (max_pan_y * 2) * t / duration
                        return (center_x, y)
                    clip = clip.with_position(pos_bt)
                    
                elif effect_type == 6:
                    # Gentle zoom in + pan left to right
                    clip = clip.resized(lambda t: zoom_start + 0.03 * t / duration)
                    def pos_lr_zoom(t):
                        x = center_x - max_pan_x * 0.5 + max_pan_x * t / duration
                        return (x, center_y)
                    clip = clip.with_position(pos_lr_zoom)
                    
                elif effect_type == 7:
                    # Gentle zoom in + pan right to left
                    clip = clip.resized(lambda t: zoom_start + 0.03 * t / duration)
                    def pos_rl_zoom(t):
                        x = center_x + max_pan_x * 0.5 - max_pan_x * t / duration
                        return (x, center_y)
                    clip = clip.with_position(pos_rl_zoom)
                    
                elif effect_type == 8:
                    # Gentle zoom out + pan top to bottom
                    clip = clip.resized(lambda t: 1.03 - 0.03 * t / duration)
                    def pos_tb_zoom(t):
                        y = center_y - max_pan_y * 0.5 + max_pan_y * t / duration
                        return (center_x, y)
                    clip = clip.with_position(pos_tb_zoom)
                    
                elif effect_type == 9:
                    # Gentle zoom out + pan bottom to top
                    clip = clip.resized(lambda t: 1.03 - 0.03 * t / duration)
                    def pos_bt_zoom(t):
                        y = center_y + max_pan_y * 0.5 - max_pan_y * t / duration
                        return (center_x, y)
                    clip = clip.with_position(pos_bt_zoom)
                    
                elif effect_type == 10:
                    # Diagonal: top-left to bottom-right (subtle)
                    clip = clip.resized(lambda t: zoom_start + 0.02 * t / duration)
                    def pos_diag_1(t):
                        x = center_x - max_pan_x * 0.3 + (max_pan_x * 0.6) * t / duration
                        y = center_y - max_pan_y * 0.3 + (max_pan_y * 0.6) * t / duration
                        return (x, y)
                    clip = clip.with_position(pos_diag_1)
                    
                else:
                    # Diagonal: bottom-right to top-left (subtle)
                    clip = clip.resized(lambda t: zoom_start + 0.02 * t / duration)
                    def pos_diag_2(t):
                        x = center_x + max_pan_x * 0.3 - (max_pan_x * 0.6) * t / duration
                        y = center_y + max_pan_y * 0.3 - (max_pan_y * 0.6) * t / duration
                        return (x, y)
                    clip = clip.with_position(pos_diag_2)
                
                container = ColorClip(size=(width, height), color=(0, 0, 0), duration=duration)
                final = CompositeVideoClip([container, clip], size=(width, height))
                
                return final
            
            def add_overlays_to_image(img, photo_caption, left_banner, price_text, is_vertical, font_banner, font_small, brand_rgb):
                """Add banners and captions to a photo"""
                draw = ImageDraw.Draw(img)
                img_w, img_h = img.size
                padding = int(img_w * 0.03)
                banner_padding = int(img_w * 0.015)
                
                if is_vertical:
                    # Vertical format (9:16)
                    # "For Sale" banner at top center
                    if left_banner and left_banner != "No Banner":
                        bbox = draw.textbbox((0, 0), left_banner, font=font_banner)
                        text_w = bbox[2] - bbox[0]
                        text_h = bbox[3] - bbox[1]
                        bg_x = (img_w - text_w) // 2 - banner_padding
                        bg_y = padding
                        draw.rectangle([bg_x, bg_y, bg_x + text_w + banner_padding * 2, bg_y + text_h + banner_padding * 2], fill=brand_rgb)
                        draw.text((bg_x + banner_padding, bg_y + banner_padding), left_banner, fill="white", font=font_banner)
                    
                    # Price banner at bottom center (above caption area)
                    if price_text:
                        bbox = draw.textbbox((0, 0), price_text, font=font_banner)
                        text_w = bbox[2] - bbox[0]
                        text_h = bbox[3] - bbox[1]
                        bg_x = (img_w - text_w) // 2 - banner_padding
                        # Leave space for caption below
                        caption_space = int(img_h * 0.12) if photo_caption else 0
                        bg_y = img_h - text_h - banner_padding * 3 - caption_space
                        draw.rectangle([bg_x, bg_y, bg_x + text_w + banner_padding * 2, bg_y + text_h + banner_padding * 2], fill=brand_rgb)
                        draw.text((bg_x + banner_padding, bg_y + banner_padding), price_text, fill="white", font=font_banner)
                    
                    # Caption at very bottom
                    if photo_caption:
                        bbox = draw.textbbox((0, 0), photo_caption, font=font_small)
                        text_w = bbox[2] - bbox[0]
                        text_h = bbox[3] - bbox[1]
                        text_x = (img_w - text_w) // 2
                        text_y = img_h - text_h - padding
                        # Semi-transparent background
                        draw.rectangle([0, text_y - padding, img_w, img_h], fill=(0, 0, 0, 180))
                        draw.text((text_x, text_y), photo_caption, fill="white", font=font_small)
                else:
                    # Horizontal format (16:9 or 1:1)
                    # "For Sale" banner top-left
                    if left_banner and left_banner != "No Banner":
                        bbox = draw.textbbox((0, 0), left_banner, font=font_banner)
                        text_w = bbox[2] - bbox[0]
                        text_h = bbox[3] - bbox[1]
                        bg_x = padding
                        bg_y = padding
                        draw.rectangle([bg_x, bg_y, bg_x + text_w + banner_padding * 2, bg_y + text_h + banner_padding * 2], fill=brand_rgb)
                        draw.text((bg_x + banner_padding, bg_y + banner_padding), left_banner, fill="white", font=font_banner)
                    
                    # Price banner top-right
                    if price_text:
                        bbox = draw.textbbox((0, 0), price_text, font=font_banner)
                        text_w = bbox[2] - bbox[0]
                        text_h = bbox[3] - bbox[1]
                        bg_x = img_w - text_w - banner_padding * 2 - padding
                        bg_y = padding
                        draw.rectangle([bg_x, bg_y, bg_x + text_w + banner_padding * 2, bg_y + text_h + banner_padding * 2], fill=brand_rgb)
                        draw.text((bg_x + banner_padding, bg_y + banner_padding), price_text, fill="white", font=font_banner)
                    
                    # Caption at bottom center
                    if photo_caption:
                        bbox = draw.textbbox((0, 0), photo_caption, font=font_small)
                        text_w = bbox[2] - bbox[0]
                        text_h = bbox[3] - bbox[1]
                        text_x = (img_w - text_w) // 2
                        text_y = img_h - text_h - padding
                        # Semi-transparent background
                        draw.rectangle([text_x - padding, text_y - padding // 2, text_x + text_w + padding, img_h], fill=(0, 0, 0))
                        draw.text((text_x, text_y), photo_caption, fill="white", font=font_small)
                
                return img
            
            for i, photo in enumerate(photos):
                photo_url = photo.get("enhanced_url") or photo.get("original_url")
                photo_caption = photo.get("caption", "")
                # Skip placeholder captions
                if photo_caption in ["Enhanced", "Virtually Staged", ""]:
                    photo_caption = ""
                
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
                
                # Add banners and captions
                img = add_overlays_to_image(img, photo_caption, left_banner, price_text, is_vertical, font_banner, font_small, brand_rgb)
                
                resized_path = os_module.path.join(temp_dir, f"resized_{i}.jpg")
                img.save(resized_path, "JPEG", quality=95)
                
                # Create clip with Ken Burns effect - cycle through all 12 effects
                effect_type = i % 12  # Alternate between all 12 different effects
                photo_clip = create_ken_burns_clip(resized_path, duration_per_photo, width, height, effect_type)
                all_clips.append(photo_clip)
            
            # === CREATE OUTRO (5 seconds) - WHITE BACKGROUND ===
            outro_img = Image.new('RGB', (width, height), color=(255, 255, 255))
            draw = ImageDraw.Draw(outro_img)
            
            # Get agent photo if available
            agent_photo_img = None
            if agent and agent.get("photo_url"):
                agent_photo_url = agent.get("photo_url", "")
                if agent_photo_url.startswith("data:"):
                    try:
                        header, photo_b64 = agent_photo_url.split(",", 1)
                        photo_data = base64.b64decode(photo_b64)
                        agent_photo_img = Image.open(io_module.BytesIO(photo_data)).convert("RGBA")
                    except:
                        agent_photo_img = None
            
            text_color = (50, 50, 50)  # Dark gray for text on white background
            
            if is_vertical:
                # Vertical layout (9:16) - WHITE BACKGROUND
                # "For more Info" title at top in brand color
                info_title = "For more Info"
                bbox_info = draw.textbbox((0, 0), info_title, font=font_large)
                info_w = bbox_info[2] - bbox_info[0]
                info_x = (width - info_w) // 2
                info_y = int(height * 0.06)
                draw.text((info_x, info_y), info_title, fill=brand_rgb, font=font_large)
                
                # Agent photo in center (circular)
                photo_y_start = int(height * 0.15)
                if agent_photo_img:
                    photo_size = int(width * 0.45)
                    agent_photo_resized = agent_photo_img.resize((photo_size, photo_size), Image.LANCZOS)
                    mask = Image.new('L', (photo_size, photo_size), 0)
                    mask_draw = ImageDraw.Draw(mask)
                    mask_draw.ellipse((0, 0, photo_size, photo_size), fill=255)
                    photo_x = (width - photo_size) // 2
                    outro_img.paste(agent_photo_resized, (photo_x, photo_y_start), mask)
                    y_pos = photo_y_start + photo_size + int(height * 0.04)
                else:
                    y_pos = int(height * 0.35)
                
                # Agent info below photo
                if agent:
                    if agent.get("name"):
                        bbox = draw.textbbox((0, 0), agent["name"], font=font_large)
                        x = (width - (bbox[2] - bbox[0])) // 2
                        draw.text((x, y_pos), agent["name"], fill=text_color, font=font_large)
                        y_pos += int(height * 0.07)
                    if agent.get("phone"):
                        bbox = draw.textbbox((0, 0), agent["phone"], font=font_medium)
                        x = (width - (bbox[2] - bbox[0])) // 2
                        draw.text((x, y_pos), agent["phone"], fill=text_color, font=font_medium)
                        y_pos += int(height * 0.05)
                    if agent.get("email"):
                        bbox = draw.textbbox((0, 0), agent["email"], font=font_small)
                        x = (width - (bbox[2] - bbox[0])) // 2
                        draw.text((x, y_pos), agent["email"], fill=text_color, font=font_small)
                        y_pos += int(height * 0.05)
                
                # Website at bottom
                if company_website:
                    bbox = draw.textbbox((0, 0), company_website, font=font_medium)
                    x = (width - (bbox[2] - bbox[0])) // 2
                    y = int(height * 0.88)
                    draw.text((x, y), company_website, fill=brand_rgb, font=font_medium)
                
                # Logo at very bottom
                if logo_img:
                    logo_max_w = int(width * 0.35)
                    logo_max_h = int(height * 0.08)
                    logo_ratio = min(logo_max_w / logo_img.width, logo_max_h / logo_img.height)
                    logo_size_v = (int(logo_img.width * logo_ratio), int(logo_img.height * logo_ratio))
                    logo_resized = logo_img.resize(logo_size_v, Image.LANCZOS)
                    logo_x = (width - logo_size_v[0]) // 2
                    logo_y = int(height * 0.92)
                    outro_img.paste(logo_resized, (logo_x, logo_y), logo_resized if logo_resized.mode == 'RGBA' else None)
            else:
                # Horizontal layout (16:9 or 1:1) - WHITE BACKGROUND
                # "For more Info" title at top center in brand color
                info_title = "For more Info"
                bbox_info = draw.textbbox((0, 0), info_title, font=font_large)
                info_w = bbox_info[2] - bbox_info[0]
                info_x = (width - info_w) // 2
                info_y = int(height * 0.08)
                draw.text((info_x, info_y), info_title, fill=brand_rgb, font=font_large)
                
                # Agent photo on left side (circular)
                agent_section_y = int(height * 0.25)
                if agent_photo_img:
                    photo_size = int(height * 0.45)
                    agent_photo_resized = agent_photo_img.resize((photo_size, photo_size), Image.LANCZOS)
                    mask = Image.new('L', (photo_size, photo_size), 0)
                    mask_draw = ImageDraw.Draw(mask)
                    mask_draw.ellipse((0, 0, photo_size, photo_size), fill=255)
                    photo_x = int(width * 0.12)
                    photo_y = agent_section_y
                    outro_img.paste(agent_photo_resized, (photo_x, photo_y), mask)
                    text_x = photo_x + photo_size + int(width * 0.06)
                else:
                    text_x = int(width * 0.2)
                
                # Agent info on right side
                y_pos = agent_section_y + int(height * 0.05)
                if agent:
                    if agent.get("name"):
                        draw.text((text_x, y_pos), agent["name"], fill=text_color, font=font_large)
                        y_pos += int(height * 0.12)
                    if agent.get("phone"):
                        draw.text((text_x, y_pos), agent["phone"], fill=text_color, font=font_medium)
                        y_pos += int(height * 0.08)
                    if agent.get("email"):
                        draw.text((text_x, y_pos), agent["email"], fill=text_color, font=font_small)
                        y_pos += int(height * 0.08)
                
                # Website and logo at bottom
                bottom_y = int(height * 0.82)
                if company_website:
                    bbox = draw.textbbox((0, 0), company_website, font=font_medium)
                    x = (width - (bbox[2] - bbox[0])) // 2
                    draw.text((x, bottom_y), company_website, fill=brand_rgb, font=font_medium)
                
                # Logo at bottom right
                if logo_img:
                    logo_max_w = int(width * 0.2)
                    logo_max_h = int(height * 0.12)
                    logo_ratio = min(logo_max_w / logo_img.width, logo_max_h / logo_img.height)
                    logo_size_h = (int(logo_img.width * logo_ratio), int(logo_img.height * logo_ratio))
                    logo_resized = logo_img.resize(logo_size_h, Image.LANCZOS)
                    logo_x = width - logo_size_h[0] - int(width * 0.05)
                    logo_y = int(height * 0.88)
                    outro_img.paste(logo_resized, (logo_x, logo_y), logo_resized if logo_resized.mode == 'RGBA' else None)
            
            outro_path = os_module.path.join(temp_dir, "outro.jpg")
            outro_img.save(outro_path, "JPEG", quality=95)
            outro_clip = ImageClip(outro_path, duration=5)
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
                fps=fps,
                codec="libx264",
                audio=False,
                preset="medium",
                bitrate=bitrate
            )
            
            # Close all clips
            for clip in all_clips:
                clip.close()
            final_clip.close()
            
            # Upload to GridFS instead of base64
            with open(output_path, "rb") as f:
                video_bytes = f.read()
            
            # Store in GridFS
            file_id = await fs.upload_from_stream(
                f"video_{video_id}.mp4",
                io_module.BytesIO(video_bytes),
                metadata={
                    "video_id": video_id,
                    "project_id": project_id,
                    "user_id": user["id"],
                    "format": format_type,
                    "quality": quality,
                    "width": width,
                    "height": height
                }
            )
            
            # Save video record to database (with GridFS reference, not base64)
            video_data = {
                "id": video_id,
                "project_id": project_id,
                "user_id": user["id"],
                "format": format_type,
                "quality": quality,
                "width": width,
                "height": height,
                "status": "completed",
                "file_url": f"/api/videos/{video_id}/stream",  # URL to stream endpoint
                "gridfs_id": str(file_id),
                "file_size": len(video_bytes),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.project_videos.insert_one(video_data)
            
            return {
                "status": "success", 
                "video_id": video_id,
                "quality": quality,
                "resolution": f"{width}x{height}",
                "file_size_mb": round(len(video_bytes) / (1024 * 1024), 2),
                "message": "Video generated successfully"
            }
            
    except Exception as e:
        print(f"Video generation error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")

