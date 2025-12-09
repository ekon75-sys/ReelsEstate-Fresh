from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel
import os
import httpx
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId

load_dotenv()

app = FastAPI(title="ReelsEstate API")

cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "reelsestate")

def get_database():
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]

class GoogleAuthRequest(BaseModel):
    code: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    plan: str = "free"
    plan_price: int = 0
    is_admin: bool = False

JWT_SECRET = os.getenv("JWT_SECRET", "fallback-secret-key")
security = HTTPBearer()

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

@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    return {"message": "OK"}

@app.get("/")
async def root():
    return {"status": "ok", "service": "ReelsEstate API"}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ReelsEstate API"}

@app.get("/api/health")
async def api_health():
    return {"status": "ok", "service": "ReelsEstate API"}

@app.post("/api/auth/google/callback")
async def google_oauth_callback(auth_data: GoogleAuthRequest):
    try:
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
            
            user_info_url = f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={token_json['access_token']}"
            user_response = await client.get(user_info_url)
            user_info = user_response.json()
            
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
                    "is_admin": (user_info['email'] == "ekon75@hotmail.com")
                }
                await db.users.insert_one(user)
            
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
        raise HTTPException(status_code=400, detail=f"Google authentication failed: {str(e)}")

@app.get("/api/auth/me")
async def get_auth_user(user_id: str = Depends(get_current_user_id)):
    try:
        db = get_database()
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            plan=user.get("plan", "free"),
            plan_price=user.get("plan_price", 0),
            is_admin=user.get("is_admin", False)
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication required")

@app.post("/api/auth/logout")
async def logout():
    return {"message": "Logged out successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))