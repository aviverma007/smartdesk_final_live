@echo off
echo ===============================================
echo Test Backend Only (Skip Frontend for now)
echo ===============================================

echo.
echo This will help you test the backend APIs directly
echo while we fix the frontend dependency issues.
echo.

echo Step 1: Starting backend server...
cd ..\backend

echo Activating Python environment...
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
) else (
    echo WARNING: Virtual environment not found
)

echo.
echo Setting force reload...
set FORCE_EXCEL_RELOAD=true

echo.
echo Starting backend server...
echo Backend APIs will be available at:
echo - http://localhost:8001/api
echo - Documentation: http://localhost:8001/docs
echo.

start /B uvicorn server:app --reload --host 0.0.0.0 --port 8001

echo.
echo Waiting for server to start...
timeout /t 5 > nul

echo.
echo Testing API endpoints...
curl -s http://localhost:8001/api/employees > nul
if %ERRORLEVEL% equ 0 (
    echo ✓ Backend is running successfully!
    echo.
    echo Open these URLs in your browser:
    echo 1. API Documentation: http://localhost:8001/docs
    echo 2. Employee API: http://localhost:8001/api/employees
    echo 3. Statistics: http://localhost:8001/api/stats
    echo.
    echo You can test all the functionality through the API docs!
) else (
    echo ✗ Backend connection failed
    echo Check the backend terminal for error messages
)

echo.
echo ===============================================
echo Backend is running - check your browser!
echo ===============================================

pause