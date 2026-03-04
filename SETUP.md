# TON Vanity Address Generator - Setup & Run Guide

## Overview

This application generates personalized TON wallet addresses by searching for addresses that match a desired prefix. It includes:

- **Frontend**: React + TypeScript with TON Connect wallet integration
- **Backend**: Express.js with real TON address generation
- **UI**: Modern dark theme with proper styling

## Prerequisites

- Node.js 18+ and npm/yarn
- macOS, Linux, or Windows

## Installation

### Backend Setup

```bash
cd backend
npm install
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

The backend will start at `http://localhost:4000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The frontend will start at `http://localhost:5173`

### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## How to Use

1. **Connect Wallet (Optional)**
   - Click "Connect Wallet" button
   - Select your TON wallet from the list
   - Confirm the connection in your wallet app

2. **Generate Vanity Address**
   - Enter a prefix (max 10 characters)
   - Click "Generate" button
   - Wait for the address generation to complete
   - Copy the generated address when ready

## Architecture

### Frontend Components

- **App.tsx**: Main application wrapper
- **VanityGenerator.tsx**: Address generation form and results
- **TonConnectIntegration.tsx**: Wallet connection interface

### Backend Endpoints

- `POST /api/vanity-address` - Generate a vanity address
  - Request: `{ prefix: string }`
  - Response: `{ success: boolean, address: string, attempts: number }`

## TON Address Generation

The vanity address generator:
- Creates random seed values
- Hashes them using SHA-256
- Converts to TON address format
- Checks if the address matches the requested prefix
- Returns the first matching address

## Troubleshooting

### Port Already in Use

**Frontend on 5173:**
```bash
lsof -i :5173
kill -9 <PID>
```

**Backend on 4000:**
```bash
lsof -i :4000
kill -9 <PID>
```

### Dependencies Not Installing

```bash
# Clear npm cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

### TON Connect Not Working

- Ensure `tonconnect-manifest.json` exists in `frontend/public/`
- Check that the manifest URL is correct
- Make sure CORS is configured properly

## Environment Variables

Create `.env` files if needed (currently not required for development):

### Backend `.env`
```
PORT=4000
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env` (not typically needed with Vite proxy)
```
VITE_API_URL=http://localhost:4000
```

## Performance Notes

- Address generation speed depends on prefix length
- Shorter prefixes (1-3 chars) are very fast
- Longer prefixes (8-10 chars) may take longer
- The algorithm tries up to 1 million addresses before timing out

## Technologies Used

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS (via CSS)
- **Backend**: Express.js, TypeScript, @ton/core, @ton/crypto
- **Wallet**: @tonconnect/ui-react
- **Icons**: lucide-react
- **HTTP Client**: axios

## License

MIT
