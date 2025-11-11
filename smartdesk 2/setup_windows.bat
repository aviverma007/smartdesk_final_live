@echo off
echo ===============================================
echo Employee Directory Application - Windows Setup
echo ===============================================

echo.
echo Checking if we're in the right directory...
if not exist "backend" (
    echo ERROR: backend directory not found!
    echo Please run this script from the application root directory
    pause
    exit /b 1
)

if not exist "frontend" (
    echo ERROR: frontend directory not found!
    echo Please run this script from the application root directory
    pause
    exit /b 1
)

echo ✓ Directory structure looks good!

echo.
echo Setting up backend...
cd backend

echo.
echo Creating Python virtual environment...
python -m venv .venv
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to create virtual environment
    echo Make sure Python 3.8+ is installed
    pause
    exit /b 1
)

echo.
echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo.
echo Installing Python dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)

echo.
echo Setting up environment file...
if not exist ".env" (
    copy local_env_template.env .env
    echo ✓ Created .env file from template
) else (
    echo ✓ .env file already exists
)

echo.
echo Running setup check...
python check_setup.py

echo.
echo Force loading Excel data...
python force_excel_load.py
if %ERRORLEVEL% neq 0 (
    echo WARNING: Excel data loading failed, but continuing...
)

cd ..

echo.
echo Setting up frontend...
cd frontend

echo.
echo Installing Node.js dependencies...
npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install Node.js dependencies
    echo Make sure Node.js 16+ is installed
    pause
    exit /b 1
)

echo.
echo Setting up frontend environment...
echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env
echo WDS_SOCKET_PORT=3000 >> .env

cd ..

echo.
echo ===============================================
echo Setup completed successfully!
echo ===============================================
echo.
echo To run the application:
echo.
echo 1. Start Backend (in one terminal):
echo    cd backend
echo    .venv\Scripts\activate
echo    uvicorn server:app --reload --host 0.0.0.0 --port 8001
echo.
echo 2. Start Frontend (in another terminal):
echo    cd frontend
echo    npm start
echo.
echo 3. Open your browser to: http://localhost:3000
echo.
echo ===============================================

pause