@echo off
echo ========================================
echo SMARTWORLD DEVELOPERS - Employee Portal
echo Automated Installation Script
echo ========================================
echo.

:: Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

set APP_DIR=C:\CompanyApps\SmartWorldEmployee
set BACKUP_DIR=C:\CompanyApps\SmartWorldEmployee\backups
set LOG_FILE=%APP_DIR%\installation.log

echo Starting installation at %date% %time% > "%LOG_FILE%"

:: Create application directories
echo Creating application directories...
if not exist "%APP_DIR%" mkdir "%APP_DIR%"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Stop any existing services
echo Stopping existing services...
pm2 stop all 2>nul
net stop MongoDB 2>nul

:: Copy application files
echo Copying application files...
xcopy "%~dp0app\*" "%APP_DIR%\" /E /I /H /Y >> "%LOG_FILE%" 2>&1

:: Install dependencies
echo Installing backend dependencies...
cd /d "%APP_DIR%\backend"
call npm install >> "%LOG_FILE%" 2>&1

echo Installing frontend dependencies...
cd /d "%APP_DIR%\frontend"
call npm install >> "%LOG_FILE%" 2>&1

:: Build frontend for production
echo Building frontend for production...
call npm run build >> "%LOG_FILE%" 2>&1

:: Configure environment files
echo Configuring environment files...
echo PORT=8001 > "%APP_DIR%\backend\.env"
echo MONGO_URL=mongodb://localhost:27017/smartworld_employees >> "%APP_DIR%\backend\.env"
echo NODE_ENV=production >> "%APP_DIR%\backend\.env"

echo REACT_APP_BACKEND_URL=https://smartworldemployee.com/api > "%APP_DIR%\frontend\.env"
echo REACT_APP_COMPANY_NAME=SMARTWORLD DEVELOPERS >> "%APP_DIR%\frontend\.env"

:: Start MongoDB service
echo Starting MongoDB service...
net start MongoDB >> "%LOG_FILE%" 2>&1

:: Configure Windows Firewall
echo Configuring Windows Firewall...
netsh advfirewall firewall add rule name="SmartWorld Employee Portal HTTP" dir=in action=allow protocol=TCP localport=80 >> "%LOG_FILE%" 2>&1
netsh advfirewall firewall add rule name="SmartWorld Employee Portal HTTPS" dir=in action=allow protocol=TCP localport=443 >> "%LOG_FILE%" 2>&1
netsh advfirewall firewall add rule name="SmartWorld Employee API" dir=in action=allow protocol=TCP localport=8001 >> "%LOG_FILE%" 2>&1

:: Start application services with PM2
echo Starting application services...
cd /d "%APP_DIR%"
pm2 start ecosystem.config.js >> "%LOG_FILE%" 2>&1
pm2 save >> "%LOG_FILE%" 2>&1
pm2 startup >> "%LOG_FILE%" 2>&1

:: Configure IIS (if available)
echo Configuring IIS...
powershell -Command "Import-Module WebAdministration; New-Website -Name 'SmartWorldEmployee' -Port 80 -PhysicalPath '%APP_DIR%\frontend\build' -Force" >> "%LOG_FILE%" 2>&1

echo.
echo ========================================
echo INSTALLATION COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Application URL: http://192.168.166.171/
echo Application URL: https://smartworldemployee.com/
echo.
echo Next steps:
echo 1. Configure your SSL certificate in IIS
echo 2. Update DNS to point smartworldemployee.com to 192.168.166.171
echo 3. Test the application from another computer
echo.
echo Installation log saved to: %LOG_FILE%
echo.
pause