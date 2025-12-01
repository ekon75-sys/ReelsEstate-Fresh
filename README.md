# ReelsEstate - Original Architecture

A Real Estate Marketing Platform for creating professional videos and managing properties.

## Architecture

- **Backend**: FastAPI (deployed on Railway)
- **Frontend**: React (deployed on Vercel)  
- **Database**: MongoDB Atlas
- **Repository**: GitHub

## Features

- 🏠 Property Management
- 📸 Photo Enhancement  
- 🎥 Video Generation
- 🔐 Google OAuth Authentication
- 💼 User Dashboard
- ⚙️ Settings Management

## Local Development

### Backend Setup (Port 8000)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your MongoDB URL and API keys
python server.py
```

### Frontend Setup (Port 3000)
```bash
cd frontend  
yarn install
cp .env.example .env
# Edit .env with your Railway backend URL
yarn start
```

## Deployment Guide

### 1. MongoDB Atlas Database
- Create cluster at https://cloud.mongodb.com/
- Get connection string
- Whitelist Railway IP addresses

### 2. Railway (Backend)
- Connect GitHub repository
- Set root directory to `backend`
- Configure environment variables
- Deploy automatically

### 3. Vercel (Frontend)
- Connect GitHub repository  
- Set root directory to `frontend`
- Configure environment variables
- Deploy automatically

### 4. Google OAuth Setup
- Create OAuth app in Google Cloud Console
- Add redirect URIs for both Railway and Vercel URLs

## Environment Variables

See `.env.example` files in both `backend/` and `frontend/` directories.

## License

Private project - All rights reserved.