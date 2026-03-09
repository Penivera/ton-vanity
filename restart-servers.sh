#!/bin/bash

echo "🔄 Restarting Vanity Address Generator..."

# Kill existing processes
echo "📌 Stopping existing servers..."
lsof -ti:4000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "✅ Servers stopped"
echo ""
echo "🚀 Starting backend..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

echo "🚀 Starting frontend..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Servers started!"
echo "📍 Backend running on: http://localhost:4000"
echo "📍 Frontend running on: http://localhost:5173"
echo ""
echo "🧪 Testing backend health..."
sleep 2
curl -s http://localhost:4000/api/health | jq .

echo ""
echo "✅ All systems ready!"
echo ""
echo "To stop servers, run:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
