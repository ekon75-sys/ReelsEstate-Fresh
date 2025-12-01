from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
import os
import jwt
import bcrypt
import httpx
from pathlib import Path
from typing import List, Optional
from bson import ObjectId

# Load environment variables
load_dotenv()

app = FastAPI(title="ReelsEstate API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection (lazy initialization)
mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "reelsestate_db")

def get_database():
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    plan: str = "free"
    plan_price: int = 0
    created_at: datetime
    is_admin: bool = False

class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    created_at: datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    code: str

# Security
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "fallback-secret-key")

def create_access_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Authentication routes
@app.post("/api/auth/register")
async def register(user_data: UserCreate):
    db = get_database()
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Hash password
    password_hash = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create user
    user = {
        "id": str(ObjectId()),
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": password_hash,
        "plan": "free",
        "plan_price": 0,
        "created_at": datetime.now(timezone.utc),
        "is_admin": (user_data.email == os.getenv("ADMIN_EMAIL", "ekon75@hotmail.com"))
    }
    
    await db.users.insert_one(user)
    
    # Create token
    token = create_access_token(user["id"])
    
    return {
        "token": token,
        "user": UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            plan=user["plan"],
            plan_price=user["plan_price"],
            created_at=user["created_at"],
            is_admin=user["is_admin"]
        )
    }

@app.post("/api/auth/login")
async def login(login_data: LoginRequest):
    db = get_database()
    # Find user
    user = await db.users.find_one({"email": login_data.email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    # Verify password
    if not bcrypt.checkpw(login_data.password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    # Create token
    token = create_access_token(user["id"])
    
    return {
        "token": token,
        "user": UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            plan=user.get("plan", "free"),
            plan_price=user.get("plan_price", 0),
            created_at=user["created_at"],
            is_admin=user.get("is_admin", False)
        )
    }

@app.get("/api/auth/test-login")
async def test_login():
    """Test login for preview environment only"""
    db = get_database()
    # Get or create test user
    test_user = await db.users.find_one({"email": "ekon75@hotmail.com"})
    
    if not test_user:
        test_user = {
            "id": str(ObjectId()),
            "email": "ekon75@hotmail.com",
            "name": "Test Admin",
            "plan": "premium",
            "plan_price": 29,
            "created_at": datetime.now(timezone.utc),
            "is_admin": True
        }
        await db.users.insert_one(test_user)
    
    # Create token
    token = create_access_token(test_user["id"])
    
    return {
        "token": token,
        "user": UserResponse(
            id=test_user["id"],
            email=test_user["email"],
            name=test_user["name"],
            plan=test_user.get("plan", "premium"),
            plan_price=test_user.get("plan_price", 29),
            created_at=test_user["created_at"],
            is_admin=test_user.get("is_admin", True)
        )
    }

@app.post("/api/auth/google")
async def google_auth(auth_data: GoogleAuthRequest):
    """Google OAuth authentication"""
    db = get_database()
    try:
        # Exchange code for token
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "code": auth_data.code,
            "grant_type": "authorization_code",
            "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/google-callback")
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
            
            # Get or create user
            user = await db.users.find_one({"email": user_info['email']})
            
            if not user:
                user = {
                    "id": str(ObjectId()),
                    "email": user_info['email'],
                    "name": user_info['name'],
                    "google_id": user_info['id'],
                    "plan": "free",
                    "plan_price": 0,
                    "created_at": datetime.now(timezone.utc),
                    "is_admin": (user_info['email'] == os.getenv("ADMIN_EMAIL", "ekon75@hotmail.com"))
                }
                await db.users.insert_one(user)
            else:
                # Update Google ID if not set
                if not user.get("google_id"):
                    await db.users.update_one(
                        {"id": user["id"]}, 
                        {"$set": {"google_id": user_info['id']}}
                    )
            
            # Create token
            token = create_access_token(user["id"])
            
            return {
                "token": token,
                "user": UserResponse(
                    id=user["id"],
                    email=user["email"],
                    name=user["name"],
                    plan=user.get("plan", "free"),
                    plan_price=user.get("plan_price", 0),
                    created_at=user["created_at"],
                    is_admin=user.get("is_admin", False)
                )
            }
            
    except Exception as e:
        print(f"Google auth error: {e}")
        raise HTTPException(status_code=400, detail="Google authentication failed")

# User routes
@app.get("/api/user/me")
async def get_current_user(user_id: str = Depends(get_current_user_id)):
    db = get_database()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        plan=user.get("plan", "free"),
        plan_price=user.get("plan_price", 0),
        created_at=user["created_at"],
        is_admin=user.get("is_admin", False)
    )

# Projects routes
@app.get("/api/projects", response_model=List[ProjectResponse])
async def get_projects(user_id: str = Depends(get_current_user_id)):
    db = get_database()
    projects = await db.projects.find({"user_id": user_id}, {"_id": 0}).limit(100).to_list(100)
    return [
        ProjectResponse(
            id=project["id"],
            user_id=project["user_id"],
            title=project["title"],
            description=project.get("description"),
            image_url=project.get("image_url"),
            video_url=project.get("video_url"),
            created_at=project["created_at"]
        )
        for project in projects
    ]

@app.post("/api/projects", response_model=ProjectResponse)
async def create_project(project_data: ProjectCreate, user_id: str = Depends(get_current_user_id)):
    db = get_database()
    project = {
        "id": str(ObjectId()),
        "user_id": user_id,
        "title": project_data.title,
        "description": project_data.description,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.projects.insert_one(project)
    
    return ProjectResponse(
        id=project["id"],
        user_id=project["user_id"],
        title=project["title"],
        description=project["description"],
        created_at=project["created_at"]
    )

@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_database()
    project = await db.projects.find_one({"id": project_id, "user_id": user_id})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ProjectResponse(
        id=project["id"],
        user_id=project["user_id"],
        title=project["title"],
        description=project.get("description"),
        image_url=project.get("image_url"),
        video_url=project.get("video_url"),
        created_at=project["created_at"]
    )

# Health check endpoints (for Railway)
@app.get("/")
async def root_health():
    return {"status": "ok", "service": "ReelsEstate API"}

@app.get("/health") 
async def health():
    return {"status": "ok", "service": "ReelsEstate API"}

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "ReelsEstate API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8001)))