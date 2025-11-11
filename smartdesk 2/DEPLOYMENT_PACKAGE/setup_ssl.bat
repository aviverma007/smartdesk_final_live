@echo off
echo ========================================
echo SMARTWORLD DEVELOPERS - SSL Setup
echo ========================================
echo.

:: Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    pause
    exit /b 1
)

echo This script will help you configure SSL/HTTPS for smartworldemployee.com
echo.

:: Check if IIS is running
sc query W3SVC | findstr "RUNNING" >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: IIS is not running. Please start IIS first.
    pause
    exit /b 1
)

echo Step 1: SSL Certificate Configuration
echo.
echo Please ensure you have your SSL certificate ready for: smartworldemployee.com
echo.
echo Certificate requirements:
echo - Certificate file (.pfx or .p7b)
echo - Private key (if separate file)
echo - Certificate password (if applicable)
echo.

pause

:: Import certificate using PowerShell
echo.
echo Importing SSL certificate...
echo.
echo Please provide the certificate file path when prompted.
echo Example: C:\Certificates\smartworldemployee.com.pfx
echo.

set /p CERT_PATH="Enter certificate file path: "
set /p CERT_PASSWORD="Enter certificate password (press Enter if none): "

if "%CERT_PASSWORD%"=="" (
    powershell -Command "Import-PfxCertificate -FilePath '%CERT_PATH%' -CertStoreLocation Cert:\LocalMachine\My"
) else (
    powershell -Command "$pwd = ConvertTo-SecureString '%CERT_PASSWORD%' -AsPlainText -Force; Import-PfxCertificate -FilePath '%CERT_PATH%' -CertStoreLocation Cert:\LocalMachine\My -Password $pwd"
)

if %errorLevel% neq 0 (
    echo ERROR: Failed to import certificate
    pause
    exit /b 1
)

echo ✅ Certificate imported successfully
echo.

:: Configure IIS binding
echo Step 2: Configuring IIS HTTPS binding...
echo.

powershell -Command "Import-Module WebAdministration; New-WebBinding -Name 'SmartWorldEmployee' -Protocol https -Port 443 -HostHeader 'smartworldemployee.com' -SslFlags 1"

if %errorLevel% equ 0 (
    echo ✅ HTTPS binding configured successfully
) else (
    echo ❌ Failed to configure HTTPS binding - please configure manually in IIS Manager
)

:: Configure HTTP to HTTPS redirect
echo.
echo Step 3: Configuring HTTP to HTTPS redirect...
echo.

powershell -Command "Import-Module WebAdministration; Add-WebConfigurationProperty -Filter 'system.webServer/rewrite/rules' -PSPath 'IIS:\Sites\SmartWorldEmployee' -Name '.' -Value @{name='HTTP to HTTPS Redirect'; patternSyntax='ECMAScript'; stopProcessing='true'}"

echo.
echo Step 4: Updating application configuration...
echo.

:: Update frontend environment file
echo REACT_APP_BACKEND_URL=https://smartworldemployee.com/api > C:\CompanyApps\SmartWorldEmployee\frontend\.env
echo REACT_APP_COMPANY_NAME=SMARTWORLD DEVELOPERS >> C:\CompanyApps\SmartWorldEmployee\frontend\.env
echo REACT_APP_SSL_ENABLED=true >> C:\CompanyApps\SmartWorldEmployee\frontend\.env

:: Restart services
echo.
echo Step 5: Restarting services...
echo.

cd /d C:\CompanyApps\SmartWorldEmployee
pm2 restart all

echo.
echo ========================================
echo SSL Configuration Completed!
echo ========================================
echo.
echo Your application is now available at:
echo ✅ https://smartworldemployee.com/
echo ✅ http://192.168.166.171/ (redirects to HTTPS)
echo.
echo Next steps:
echo 1. Test HTTPS access from another computer
echo 2. Verify certificate validity
echo 3. Configure DNS if not already done
echo.
echo Certificate information:
powershell -Command "Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Subject -like '*smartworld*'} | Format-List Subject, Thumbprint, NotAfter"
echo.
pause