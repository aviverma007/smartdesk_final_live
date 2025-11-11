@echo off
echo ===============================================
echo Manual Frontend Installation - Alternative Method
echo ===============================================

echo.
echo If the automatic fix didn't work, try these manual steps:
echo.

echo Step 1: Clean installation
echo rmdir /S /Q node_modules
echo del package-lock.json
echo del yarn.lock
echo.

echo Step 2: Install with legacy peer deps
echo npm install --legacy-peer-deps
echo.

echo Step 3: If step 2 fails, try force install
echo npm install --force
echo.

echo Step 4: If still having issues, downgrade React
echo npm install react@18.2.0 react-dom@18.2.0 --legacy-peer-deps
echo npm install date-fns@3.6.0 --legacy-peer-deps
echo.

echo Step 5: Try with Yarn instead of npm
echo npm install -g yarn
echo yarn install
echo.

echo Step 6: Alternative - use different versions
echo npm install react-day-picker@8.8.0 --legacy-peer-deps
echo npm install eslint@8.57.1 --save-dev --legacy-peer-deps
echo.

echo ===============================================
echo Choose one method above and run the commands manually
echo ===============================================

pause