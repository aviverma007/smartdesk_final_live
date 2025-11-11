# 🚀 Quick Start Guide - Windows

## Frontend Dependency Issues Fix

You're encountering version conflicts between React 19, ESLint 9, and older component libraries. Here are **3 methods** to fix this:

---

## 🔧 Method 1: Automated Fix (Recommended)

```cmd
cd frontend
fix_frontend.bat
```

This script will:
- Clean old installations
- Use compatible package versions
- Install with `--legacy-peer-deps`
- Set up environment files

---

## 🔧 Method 2: Manual Fix with Legacy Peer Deps

```cmd
cd frontend

# Clean installation
rmdir /S /Q node_modules
del package-lock.json

# Install with legacy peer deps (ignore version conflicts)
npm install --legacy-peer-deps

# If that fails, try force install
npm install --force

# Create environment file
echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env
```

---

## 🔧 Method 3: Use Yarn Instead of NPM

```cmd
cd frontend

# Clean installation
rmdir /S /Q node_modules
del package-lock.json

# Install Yarn globally
npm install -g yarn

# Install dependencies with Yarn
yarn install

# Create environment file  
echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env
```

---

## 🏃‍♂️ Complete Application Startup

### 1. Backend (Terminal 1):
```cmd
cd backend
.venv\Scripts\activate
set FORCE_EXCEL_RELOAD=true
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### 2. Frontend (Terminal 2):
```cmd
cd frontend
npm start
```

### 3. Access Application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001/api
- **API Docs**: http://localhost:8001/docs

---

## 🔍 If Still Having Issues

### Option A: Use the provided scripts
```cmd
# Run the automated frontend fix
frontend\fix_frontend.bat

# Or check manual steps
frontend\manual_install_steps.bat
```

### Option B: Force compatible versions
```cmd
cd frontend
npm install react@18.2.0 react-dom@18.2.0 --legacy-peer-deps
npm install date-fns@3.6.0 --legacy-peer-deps  
npm install eslint@8.57.1 --save-dev --legacy-peer-deps
npm install --legacy-peer-deps
```

### Option C: Skip frontend for now, test backend
```cmd
cd backend
.venv\Scripts\activate
python force_excel_load.py
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

Then test backend APIs at: http://localhost:8001/docs

---

## 🎯 Why This Happens

The issues you're seeing are because:
1. **React 19** is very new (Dec 2024) but many UI libraries still expect React 18
2. **ESLint 9** introduced breaking changes that older plugins don't support  
3. **date-fns 4.x** has breaking changes from 3.x that react-day-picker doesn't support

The `--legacy-peer-deps` flag tells npm to use the old dependency resolution algorithm, which is more permissive.

---

## ✅ Expected Result

After successful installation, you should see:
- No more dependency errors
- Frontend starts on http://localhost:3000
- Backend APIs accessible at http://localhost:8001/api
- 640 employees loaded from Excel in the application

---

## 🆘 Still Need Help?

If none of these methods work, share:
1. Your Node.js version: `node --version`
2. Your npm version: `npm --version`  
3. The exact error message you're getting
4. Which method you tried

The application backend should work independently, so you can test it first while we fix the frontend.