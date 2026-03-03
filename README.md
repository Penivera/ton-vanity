# TON Vanity Address Generator

A high-performance vanity address generator for TON blockchain wallets. Generate custom TON addresses with your desired patterns (e.g., `EQBONK...`, `EQ...420`, `EQ...COOL`).

## ✨ Features

- 🎯 **Custom Patterns**: Prefix, suffix, or contains matching
- ⚡ **Fast Generation**: Multi-threaded parallel search (40k-200k addresses/sec)
- 🔐 **Secure**: Keys generated locally, never stored
- 🎨 **Modern UI**: Clean React interface with real-time progress
- 📱 **Telegram Ready**: Mini app compatible
- ✅ **Fixed CRC32C**: Uses official TON wallet contracts for valid addresses

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

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd ton-vanity

# Start backend
cd backend
npm install
npm run dev     # Runs on http://localhost:3001

# Start frontend (new terminal)
cd frontend
npm install
npm run dev     # Runs on http://localhost:5174
```

Open http://localhost:5174 and start generating!

## 📋 Pattern Rules

- **Length**: 3-6 characters
- **Characters**: Letters (A-Z, a-z), numbers (0-9), underscore (_), hyphen (-)
- **Types**:
  - **Prefix**: Pattern appears after `EQ` (e.g., `EQ[BONK]xxx...`)
  - **Suffix**: Pattern appears at end (e.g., `EQxxx...[BONK]`)
  - **Contains**: Pattern appears anywhere (e.g., `EQxx[BONK]xx`)
- **Case Sensitive**: Optional (dramatically increases difficulty)

### ⏱️ Expected Generation Times

| Pattern Length | Avg. Attempts | Time @ 100k/sec |
|----------------|---------------|------------------|
| 3 characters   | ~260k         | 2-5 seconds      |
| 4 characters   | ~16M          | 2-5 minutes      |
| 5 characters   | ~1B           | 2-5 hours        |
| 6 characters   | ~68B          | 7-10 days        |

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

## 🛠️ Technical Details

### Architecture
- **Frontend**: React + TypeScript + Vite + Socket.IO
- **Backend**: Node.js + Express + Socket.IO + Worker Threads
- **Blockchain**: @ton/ton, @ton/crypto, @ton/core

### How It Works
1. User enters pattern (e.g., "BONK")
2. Backend spawns 4 worker threads (parallel processing)
3. Each worker:
   - Generates random 32-byte seed
   - Derives ED25519 keypair
   - Creates official TON wallet contract (V4R2 or V3R2)
   - Gets address with valid CRC32C checksum
   - Checks if address matches pattern
4. First match returns address + keys to user
5. All workers terminate

### Wallet Types
- **V4R2**: Latest TON wallet standard with plugin support
- **V3R2 (Simple)**: Legacy wallet, widely compatible

## 🔧 Troubleshooting

### "Invalid CRC32C" Error
**Fixed in latest version!** Now uses official `WalletContractV4` and `WalletContractV3R2` from `@ton/ton` library, guaranteeing valid checksums.

### Worker Module Not Found
Backend now auto-detects TypeScript vs JavaScript runtime and loads correct worker file.

### Blank Screen (Frontend)
Buffer polyfills added for browser compatibility. Ensure `polyfills.ts` is imported first in `main.tsx`.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: System design, data flow, API reference
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**: Common errors and solutions

## ⚠️ Security Notes

- Private keys are **never stored** on server or database
- Keys generated in-memory and returned once via WebSocket
- **User responsibility**: Save private keys immediately and securely
- Uses `crypto.randomBytes(32)` for cryptographically secure seeds
- All addresses verified with `Address.parse()` before returning
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