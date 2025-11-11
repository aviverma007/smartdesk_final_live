@echo off
echo ===============================================
echo Simple Frontend Start (Force Methods)
echo ===============================================

echo.
echo Trying multiple methods to start the frontend...

echo Method 1: Legacy peer deps install
npm install --legacy-peer-deps
if %ERRORLEVEL% equ 0 (
    echo ✓ Legacy peer deps worked!
    goto start_app
)

echo Method 2: Force install
npm install --force
if %ERRORLEVEL% equ 0 (
    echo ✓ Force install worked!
    goto start_app
)

echo Method 3: Using Yarn
npm install -g yarn > nul 2>&1
yarn install
if %ERRORLEVEL% equ 0 (
    echo ✓ Yarn install worked!
    yarn start
    exit /b 0
)

echo Method 4: Skip install, try direct start
goto start_app

:start_app
echo.
echo Creating environment file...
echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env

echo.
echo Starting the application...
npm start

pause