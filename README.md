# TON Vanity Address Generator

A Telegram Mini App for generating custom vanity TON wallet addresses.

## Architecture

```
├── frontend/          # Telegram Mini App (React + Vite)
│   ├── src/
│   │   ├── App.tsx   # Main UI
│   │   ├── App.css   # Styling
│   │   └── main.tsx  # Entry
│   └── index.html    # Telegram WebApp SDK
│
└── backend/           # Node.js + Express + Socket.io
    ├── src/
    │   ├── index.ts              # Main server
    │   ├── types/
    │   │   └── index.ts          # Type definitions
    │   └── workers/
    │       └── vanityWorker.ts   # Address generation worker
    └── package.json
```

## Features

- **Pattern Matching**: Prefix, suffix, or contains (3-6 hex characters)
- **Wallet Types**: V4R2 (standard) and Simple Wallet
- **Real-time Progress**: Live attempts counter with estimated time
- **Parallel Generation**: 4 worker threads for faster searching
- **Security**: Private keys generated on backend, displayed once, never stored

## Setup

### Backend

```bash
cd backend
npm install

# Create .env
cp .env.example .env
# Edit .env if needed (default PORT=3001)

# Development
npm run dev

# Production
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm install

# Create .env
cp .env.example .env
# Edit VITE_SOCKET_URL to point to your backend

# Development
npm run dev

# Production build
npm run build
```

## Telegram Bot Setup

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Enable Mini App: `/newapp` or `/mybots` → Select bot → Mini App
3. Set the URL to your deployed frontend
4. Start the bot and open the Mini App

## Deployment

### Backend (Railway/Render)

1. Push code to GitHub
2. Connect Railway/Render to repo
3. Set root directory to `backend/`
4. Add environment variable: `PORT=3001`
5. Deploy

### Frontend (Vercel)

1. Push code to GitHub
2. Import to Vercel
3. Set root directory to `frontend/`
4. Add environment variable: `VITE_SOCKET_URL=https://your-backend-url`
5. Deploy

## How It Works

1. User enters pattern (e.g., "BONK")
2. Backend spawns 4 worker threads
3. Each worker generates random keypairs and calculates addresses
4. First worker to find a match sends it back
5. Frontend displays address, public key, and private key
6. User must save private key immediately (not stored)

## Security Notes

- Private keys are generated on the backend and transmitted securely
- Keys are never stored on the server
- User must save private key immediately - there's no recovery
- Always verify the address before using

## TODO / Phase 2

- [ ] TON Connect integration for one-click deployment
- [ ] Token deployment (Jetton master contract)
- [ ] Share results on social media
- [ ] Pattern strength indicator
- [ ] Batch generation (multiple addresses)