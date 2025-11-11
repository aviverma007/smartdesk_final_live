@echo off
echo ========================================
echo SMARTWORLD DEVELOPERS - System Check
echo ========================================
echo.

echo Checking system requirements...
echo.

:: Check administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ ERROR: Script must be run as Administrator
    goto :end
) else (
    echo ✅ Administrator privileges: OK
)

:: Check Node.js
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Node.js: NOT INSTALLED
    echo    Download from: https://nodejs.org/
) else (
    for /f %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js: %NODE_VERSION%
)

:: Check Python
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Python: NOT INSTALLED
    echo    Download from: https://python.org/
) else (
    for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
    echo ✅ Python: %PYTHON_VERSION%
)

:: Check MongoDB
net start | findstr "MongoDB" >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ MongoDB: NOT RUNNING
    echo    Install MongoDB Community Server
) else (
    echo ✅ MongoDB: RUNNING
)

:: Check PM2
pm2 --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ PM2: NOT INSTALLED
    echo    Install with: npm install -g pm2
) else (
    for /f %%i in ('pm2 --version') do set PM2_VERSION=%%i
    echo ✅ PM2: %PM2_VERSION%
)

:: Check IIS
sc query W3SVC | findstr "RUNNING" >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ IIS: NOT RUNNING
    echo    Enable IIS in Windows Features
) else (
    echo ✅ IIS: RUNNING
)

:: Check available disk space
for /f "tokens=3" %%i in ('dir C:\ ^| findstr "bytes free"') do set DISK_SPACE=%%i
echo ✅ Available disk space: %DISK_SPACE% bytes

:: Check network configuration
echo.
echo Network Configuration:
ipconfig | findstr "IPv4"
ipconfig | findstr "Subnet"
ipconfig | findstr "Default Gateway"

:: Check firewall ports
echo.
echo Checking firewall ports...
netsh advfirewall firewall show rule name="SmartWorld Employee Portal HTTP" >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Firewall HTTP rule: NOT CONFIGURED
) else (
    echo ✅ Firewall HTTP rule: CONFIGURED
)

netsh advfirewall firewall show rule name="SmartWorld Employee Portal HTTPS" >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Firewall HTTPS rule: NOT CONFIGURED
) else (
    echo ✅ Firewall HTTPS rule: CONFIGURED
)

echo.
echo ========================================
echo System check completed!
echo.
echo If all requirements are met (✅), you can proceed with installation.
echo If any items show (❌), please install the required software first.
echo ========================================

:end
pause