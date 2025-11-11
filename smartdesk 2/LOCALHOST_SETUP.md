# SmartWorld Employee Directory - Localhost Setup Guide

This application has been configured to run entirely on localhost, with all Emergent integrations removed.

## Prerequisites

- Python 3.11+
- Node.js 18+ with Yarn
- MongoDB (running on localhost:27017)

## Quick Start

### 1. Start MongoDB
Ensure MongoDB is running on the default port (27017):
```bash
# Check if MongoDB is running
pgrep mongod

# If not running, start it (method depends on your system)
mongod
```

### 2. Start Backend Server
```bash
cd backend
pip install -r requirements.txt
python server.py
```
Backend will start on: http://localhost:8001

### 3. Start Frontend Server
```bash
cd frontend
yarn install
yarn start
```
Frontend will start on: http://localhost:3000

### 4. Access the Application
Open your browser and navigate to: http://localhost:3000

## Login Credentials

The application has two access levels:
- **Administrator Access**: Full access to all features
- **User Access**: Limited access to essential features

## Application Features

### Core Features Available:
- **Employee Directory**: Browse, search, and manage employee information
- **Meeting Room Management**: Book and manage meeting rooms
- **Task Management**: Create and track tasks (Admin only)
- **Knowledge Base**: Access company knowledge articles (Admin only)
- **Company Policies**: View and manage policies
- **Holiday Calendar**: View company holidays and important dates
- **Help & Support**: Submit and track support requests (Admin only)
- **Alerts System**: Create and manage system alerts (Admin only)

### Data Included:
- 625+ employee records loaded from Excel
- Meeting rooms across multiple locations (IFC, Noida, etc.)
- Company holiday calendar for 2025
- Organizational hierarchy management

## Configuration Files

### Backend Configuration (`backend/.env`)
```
MONGO_URL=mongodb://localhost:27017/smartworld
```

### Frontend Configuration (`frontend/.env`)
```
PORT=3000
REACT_APP_BACKEND_URL=http://localhost:8001
```

## API Endpoints

The backend API is accessible at `http://localhost:8001/api/`

Key endpoints:
- GET `/api/employees` - Employee data
- GET `/api/meeting-rooms` - Meeting room information
- GET `/api/health` - Backend health check

## Troubleshooting

### Common Issues:

1. **Port Already in Use**
   - Backend: Change port in `server.py` (line 1361: `port = int(os.environ.get("PORT", 8001))`)
   - Frontend: Change PORT in `frontend/.env`

2. **MongoDB Connection Issues**
   - Ensure MongoDB is running: `pgrep mongod`
   - Check MongoDB logs for errors
   - Verify connection string in `backend/.env`

3. **Frontend-Backend Connectivity**
   - Verify REACT_APP_BACKEND_URL in `frontend/.env` points to correct backend URL
   - Check browser console for CORS errors
   - Ensure backend CORS allows frontend origin

4. **Missing Employee Data**
   - Employee data is loaded from Excel file on backend startup
   - Check for Excel file in: `/app/frontend/public/employee_directory.xlsx`
   - Backend logs will show data loading status

### Logs:
- Backend logs: Check console output when running `python server.py`
- Frontend logs: Check browser developer tools console
- MongoDB logs: Check system logs or MongoDB log files

## Development

### Adding New Features:
1. Backend: Add new API endpoints in `backend/server.py`
2. Frontend: Create new components in `frontend/src/components/`
3. Update dependencies in respective `requirements.txt` or `package.json`

### Database:
- Database name: `smartworld`
- Collections are created automatically
- Employee data is loaded from Excel on startup

## Production Deployment

For production deployment:
1. Update MongoDB URL to production instance
2. Configure proper CORS origins (remove "*")
3. Set up proper environment variables
4. Use production builds (`yarn build`)
5. Configure reverse proxy (nginx/apache)

---

## Changes Made from Original

This version has been modified to:
- ✅ Remove all Emergent platform dependencies
- ✅ Configure for localhost development
- ✅ Download and store original images locally in `/frontend/public/images/`
- ✅ Remove FloatingChatbot component
- ✅ Update environment configuration for local development
- ✅ Ensure all features work offline

**Images Preserved**: All original images from the Emergent platform have been downloaded and stored locally to maintain the exact same visual appearance while removing external dependencies.

The application now runs completely independently on localhost without any external dependencies.