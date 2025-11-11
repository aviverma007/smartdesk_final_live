# Windows Setup Guide for Employee Directory Application

## Prerequisites

### 1. Install MongoDB
1. Download MongoDB Community Server: https://www.mongodb.com/download-center/community
2. Install MongoDB with default settings
3. Start MongoDB service:
   ```cmd
   net start MongoDB
   ```
   Or start manually from Services (services.msc)

### 2. Install Node.js and Python
- Node.js 16+ from https://nodejs.org/
- Python 3.8+ from https://python.org/

## Setup Instructions

### Step 1: Clone and Setup Backend

1. **Clone the repository**:
   ```cmd
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Navigate to backend directory**:
   ```cmd
   cd backend
   ```

3. **Create virtual environment** (recommended):
   ```cmd
   python -m venv .venv
   .venv\Scripts\activate
   ```

4. **Install dependencies**:
   ```cmd
   pip install -r requirements.txt
   ```

5. **Setup environment file**:
   ```cmd
   copy local_env_template.env .env
   ```
   Edit `.env` file if needed (default should work for local MongoDB)

6. **Check setup**:
   ```cmd
   python check_setup.py
   ```

7. **Force load Excel data** (if database has old data):
   ```cmd
   python force_excel_load.py
   ```

### Step 2: Setup Frontend

1. **Navigate to frontend directory**:
   ```cmd
   cd ../frontend
   ```

2. **Install dependencies** (use npm or yarn):
   ```cmd
   npm install
   ```

3. **Create/update environment file**:
   ```cmd
   echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env
   echo WDS_SOCKET_PORT=3000 >> .env
   ```

### Step 3: Run the Application

1. **Start Backend** (in backend directory):
   ```cmd
   cd backend
   .venv\Scripts\activate
   uvicorn server:app --reload --host 0.0.0.0 --port 8001
   ```

2. **Start Frontend** (in frontend directory, new terminal):
   ```cmd
   cd frontend
   npm start
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8001/api
   - API Documentation: http://localhost:8001/docs

## Troubleshooting

### Backend Issues

1. **"Database already has employees" message**:
   - Run: `python force_excel_load.py` to clear and reload data

2. **MongoDB connection errors**:
   - Make sure MongoDB service is running: `net start MongoDB`
   - Check if port 27017 is available

3. **Excel file not found**:
   - Ensure `employee_directory.xlsx` exists in backend directory
   - Check file path in `excel_parser.py`

4. **Import errors**:
   - Reinstall requirements: `pip install -r requirements.txt --force-reinstall`
   - Check Python version: `python --version` (should be 3.8+)

### Frontend Issues

1. **Backend connection errors**:
   - Ensure backend is running on port 8001
   - Check `.env` file has correct `REACT_APP_BACKEND_URL`

2. **Build warnings**:
   - Most warnings can be ignored for development
   - Run `npm audit fix` for security updates

### General Issues

1. **Port conflicts**:
   - Backend: Change port in uvicorn command
   - Frontend: Change port in package.json start script

2. **Permission issues**:
   - Run terminals as Administrator if needed
   - Check file/folder permissions

## Development Commands

### Backend
```cmd
# Check setup
python check_setup.py

# Force reload data
python force_excel_load.py

# Start server
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Run tests
python -m pytest
```

### Frontend
```cmd
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Default Login
- **Admin Access**: Use the admin login button on the login page
- No username/password required for demo

## Features Available
1. **Home**: News management
2. **Employee Directory**: View/edit employees, hierarchy management  
3. **Work**: Task management system
4. **Knowledge**: Company information and policies
5. **Help**: Support ticket system

## API Endpoints
- Employees: `GET/POST/PUT/DELETE /api/employees`
- Hierarchy: `GET/POST/DELETE /api/hierarchy`  
- Meeting Rooms: `GET/POST /api/meeting-rooms`
- Tasks: `GET/POST/PUT/DELETE /api/tasks`
- News: `GET/POST/PUT/DELETE /api/news`
- And more...

For full API documentation, visit: http://localhost:8001/docs