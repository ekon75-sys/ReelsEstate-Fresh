from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel
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
from fastapi import Header

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
