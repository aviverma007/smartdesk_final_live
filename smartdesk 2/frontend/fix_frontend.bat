@echo off
echo ===============================================
echo Fixing Frontend Dependencies - Windows
echo ===============================================

echo.
echo Step 1: Cleaning previous installation...
if exist "node_modules" (
    echo Removing node_modules directory...
    rmdir /S /Q node_modules
)

if exist "package-lock.json" (
    echo Removing package-lock.json...
    del package-lock.json
)

if exist "yarn.lock" (
    echo Removing yarn.lock...
    del yarn.lock
)

echo ✓ Cleanup completed

echo.
echo Step 2: Backing up current package.json...
copy package.json package_original.json
echo ✓ Original package.json backed up as package_original.json

echo.
echo Step 3: Using fixed package.json with compatible versions...
copy package_fixed.json package.json
echo ✓ Switched to compatible package.json

echo.
echo Step 4: Installing dependencies with legacy peer deps...
npm install --legacy-peer-deps
if %ERRORLEVEL% neq 0 (
    echo.
    echo Installation failed with --legacy-peer-deps, trying --force...
    npm install --force
    if %ERRORLEVEL% neq 0 (
        echo.
        echo ERROR: Both installation methods failed!
        echo Restoring original package.json...
        copy package_original.json package.json
        echo.
        echo Please try manual installation:
        echo npm install --legacy-peer-deps
        echo or
        echo npm install --force
        pause
        exit /b 1
    )
)

echo.
echo Step 5: Setting up environment file...
echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env
echo WDS_SOCKET_PORT=3000 >> .env
echo ✓ Environment file created

echo.
echo ===============================================
echo Frontend Setup Completed Successfully!
echo ===============================================
echo.
echo To start the frontend:
echo npm start
echo.
echo Frontend will be available at: http://localhost:3000
echo ===============================================

pause