# TON Vanity Address Generator - Architecture

## Overview

This application generates custom TON blockchain wallet addresses (vanity addresses) using multi-threaded brute force search. Users can specify patterns that appear at the start, end, or anywhere in the address.

## System Architecture

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│                 │◄──────────────────────────►│                  │
│  React Frontend │                             │  Express Backend │
│   (Vite + TS)   │         Socket.io           │    (Node.js)     │
│                 │                             │                  │
└─────────────────┘                             └────────┬─────────┘
                                                         │
                                                         │ Spawns
                                                         ▼
                                              ┌──────────────────────┐
                                              │  Worker Thread Pool  │
                                              │  (4x Parallel)       │
                                              ├──────────────────────┤
                                              │  vanityWorker.ts     │
                                              │  - Generate keypairs │
                                              │  - Check patterns    │
                                              │  - Report progress   │
                                              └──────────────────────┘
```

## Key Components

### Frontend (`/frontend`)

- **React** - UI framework
- **Socket.IO Client** - Real-time communication with backend
- **QRCode.react** - Display generated addresses as QR codes
- **Lucide Icons** - UI icons

### Backend (`/backend`)

- **Express** - HTTP server
- **Socket.IO** - WebSocket server for real-time updates
- **Worker Threads** - CPU-intensive address generation
- **@ton/ton** - Official TON blockchain SDK
- **@ton/crypto** - Cryptographic operations (keypair generation)

## Address Generation Flow

### 1. User Input
```typescript
interface VanityRequest {
  pattern: string;           // e.g., "BONK"
  type: 'prefix' | 'suffix' | 'contains';
  caseSensitive: boolean;
  walletType: 'v4r2' | 'simple';
}
```

### 2. Worker Spawning
Backend spawns 4 worker threads, each with:
- Different starting nonce (0, 10M, 20M, 30M)
- Same pattern search parameters
- Independent progress reporting

### 3. Address Generation (per worker)

```typescript
while (attempts < maxAttempts) {
  // 1. Generate random 32-byte seed
  const seed = randomBytes(32);
  
  // 2. Derive ED25519 keypair from seed
  const keyPair = keyPairFromSeed(seed);
  
  // 3. Create wallet contract (V4R2 or V3R2)
  const wallet = WalletContractV4.create({ 
    workchain: 0, 
    publicKey: keyPair.publicKey 
  });
  
  // 4. Get address with valid CRC32C checksum
  const address = wallet.address.toString({
    bounceable: true,
    urlSafe: true
  });
  
  // 5. Check if matches pattern
  if (checkPattern(address, pattern, type, caseSensitive)) {
    return { address, publicKey, secretKey, attempts };
  }
  
  attempts++;
}
```

### 4. Pattern Matching

```typescript
type PatternType = 'prefix' | 'suffix' | 'contains';

// prefix: EQ[PATTERN]xxxxxx... (pattern after EQ/UQ prefix)
// suffix: EQxxxxxxxx...[PATTERN]
// contains: EQxxx[PATTERN]xxx...
```

### 5. Progress Updates

Workers report every 1000 attempts:
```typescript
{
  type: 'progress',
  data: { attempts: 1000 },
  workerId: 0
}
```

Frontend aggregates and displays:
- Total attempts across all workers
- Attempts per second
- Estimated time remaining

### 6. Success

When match found:
```typescript
{
  type: 'found',
  data: {
    address: "EQBONKxxx...",
    publicKey: "hex string",
    secretKey: "hex string", 
    attempts: 123456
  }
}
```

All workers are terminated, result displayed to user.

## TON Address Format

### Structure
```
EQAbc123...xyz  (48 chars total)
││ └─ Base64url data (44 chars)
│└── 2-byte CRC32C checksum
└─── Prefix: EQ (bounceable) or UQ (non-bounceable)
```

### CRC32C Checksum
- TON addresses include a CRC32C checksum for validation
- Invalid addresses cannot be parsed
- Our implementation uses official wallet contracts to guarantee valid checksums

### Why This Matters
Previous implementation used hardcoded wallet code cells that produced **invalid CRC32C checksums**, causing the "Invalid CRC32C" error. Current implementation fixes this by using official `WalletContractV4` and `WalletContractV3R2` from `@ton/ton` library.

## Wallet Types

### V4R2 (Recommended)
- Latest TON wallet standard
- Supports plugins and advanced features
- Future-proof

```typescript
WalletContractV4.create({ 
  workchain: 0, 
  publicKey 
})
```

### V3R2 (Legacy "Simple")
- Widely compatible
- No plugin support
- Simpler implementation

```typescript
WalletContractV3R2.create({ 
  workchain: 0, 
  publicKey 
})
```

## Performance

### Typical Generation Speed
- **Per worker**: 10,000 - 50,000 addresses/second (CPU dependent)
- **4 workers**: 40,000 - 200,000 addresses/second total
- **M1/M2 Mac**: ~150,000 addresses/second
- **Intel CPU**: ~80,000 addresses/second

### Pattern Difficulty

Base64url alphabet: `A-Za-z0-9_-` (64 chars)

| Pattern Length | Avg. Attempts | Time (@ 100k/sec) |
|----------------|---------------|-------------------|
| 3 chars        | ~260k         | 2-5 seconds       |
| 4 chars        | ~16M          | 2-5 minutes       |
| 5 chars        | ~1B           | 2-5 hours         |
| 6 chars        | ~68B          | 7-10 days         |

**Note**: Times are statistical averages. Actual time varies widely due to randomness.

## Security Considerations

### Private Key Storage
- **Never stored on server**
- Generated in-memory, returned once
- User responsible for secure storage

### Seed Generation
- Uses `crypto.randomBytes(32)` for cryptographically secure entropy
- ED25519 keypairs derived using official TON crypto library

### Address Validation
All generated addresses verified using:
```typescript
Address.parse(addressString); // Throws if invalid CRC32C
```

## Error Handling

### "Invalid CRC32C" Error
**Cause**: Attempting to parse malformed TON address without valid checksum.

**Fixed by**:
1. Using official wallet contracts (`WalletContractV4`, `WalletContractV3R2`)
2. Removing manual state init construction
3. Try-catch in generation loop to prevent worker crashes

### Worker Errors
Each worker has try-catch around generation:
```typescript
try {
  // Generate and check address
} catch (error) {
  console.error(`Worker ${workerId} generation error:`, error);
  attempts++; // Continue despite errors
}
```

## API Endpoints

### WebSocket Events (Socket.IO)

#### Client → Server
```typescript
// Start generation
socket.emit('start-generation', {
  pattern: string,
  type: 'prefix' | 'suffix' | 'contains',
  caseSensitive: boolean,
  walletType: 'v4r2' | 'simple'
});

// Stop generation
socket.emit('stop-generation');
```

#### Server → Client
```typescript
// Progress update
socket.on('progress', {
  attempts: number,
  attemptsPerSecond: number,
  estimatedTimeSeconds: number | null,
  status: 'running'
});

// Address found
socket.on('found', {
  address: string,
  publicKey: string,
  secretKey: string,
  walletType: 'v4r2' | 'simple',
  pattern: string,
  attempts: number,
  timeTaken: number
});

// Generation stopped
socket.on('stopped');

// Error
socket.on('error', { message: string });

// Server log message
socket.on('log', message: string);
```

### HTTP Endpoints

#### POST `/api/tonconnect`
TON Connect deep link generation.

**Request**:
```json
{
  "appName": "MyApp",
  "walletAddress": "EQAbc123..."
}
```

**Response**:
```json
{
  "deepLink": "https://tonconnect.io?connect=..."
}
```

**Errors**:
- 400: Invalid TON wallet address (catches CRC32C errors)
- 400: Missing appName or walletAddress

## Development

### Backend
```bash
cd backend
npm install
npm run dev    # Development with ts-node
npm run build  # Compile TypeScript
npm start      # Production
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # Development server
npm run build  # Production build
```

### Key Files
```
backend/
├── src/
│   ├── index.ts              # Main server & Socket.IO
│   ├── tonConnect.ts         # TON Connect link generation
│   ├── types/index.ts        # TypeScript interfaces
│   └── workers/
│       └── vanityWorker.ts   # Address generation worker
frontend/
├── src/
│   ├── App.tsx               # Main UI component
│   ├── App.css               # Styles
│   ├── main.tsx              # React entry
│   ├── polyfills.ts          # Buffer/Node.js polyfills
│   └── tonConnect.tsx        # Wallet connect component
```

## Future Enhancements

1. **GPU Acceleration** - Use WebGL/CUDA for faster generation
2. **Pattern Templates** - Pre-made patterns (emoji, words, etc.)
3. **Batch Generation** - Generate multiple addresses at once
4. **Pattern Validation** - Warn users about impossible patterns
5. **Save History** - Store previously generated addresses
6. **Telegram Mini App** - Native Telegram integration
7. **Mobile App** - React Native version

## License

MIT
