# 🔧 Quick Fix for 404 Error

## Problem
The frontend is showing a 404 error when trying to generate addresses, even though the backend is working perfectly.

## Cause
The Vite dev server needs to be restarted after configuration changes for the proxy to work correctly.

## ✅ Solution - Restart Frontend

### Option 1: Simple Restart

**Terminal 1 (Backend - Keep Running):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend - Restart This):**
```bash
# 1. Stop the current frontend (press Ctrl+C in the terminal)
# 2. Restart it:
cd frontend
npm run dev
```

### Option 2: Restart Both Cleanly

```bash
# Kill both servers
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

### Option 3: Use Restart Script

```bash
./restart-servers.sh
```

## ✅ Test It Works

1. Open browser: `http://localhost:5173`
2. Enter a prefix (e.g., "TON")
3. Click "Generate"
4. Should see address generated successfully!

## 🧪 Backend Health Check

The backend is working perfectly. You can test:

```bash
# Health check
curl http://localhost:4000/api/health

# Generate address directly
curl -X POST http://localhost:4000/api/vanity-address \
  -H "Content-Type: application/json" \
  -d '{"prefix":"TEST"}'
```

Both should return successful responses.

## 🐛 Enhanced Debugging

I've added console logging to the frontend. After restarting, open browser DevTools console to see:
- Request being made
- Response received
- Any errors with full details

## Why This Happens

Vite's dev server caches the proxy configuration. When we updated `vite.config.ts`, the running server didn't pick up the changes. A restart loads the new config.

## 📝 Summary

✅ Backend is working perfectly  
✅ Endpoint `/api/vanity-address` responds correctly  
✅ Frontend code is correct  
❌ Frontend dev server needs restart to load proxy config  

**→ Just restart the frontend dev server and it will work!**
