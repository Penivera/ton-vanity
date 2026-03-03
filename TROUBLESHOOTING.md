# Troubleshooting Guide

## Common Errors & Solutions

### "Invalid CRC32C"

**Symptom**: Error appears when generating addresses or connecting wallet.

**Cause**: Attempting to parse a malformed TON address without a valid CRC32C checksum.

**Solutions**:

1. **For address generation errors** - Fixed in latest version:
   - Old code used hardcoded wallet code cells with incorrect format
   - New code uses official `WalletContractV4` and `WalletContractV3R2` from `@ton/ton`
   - All generated addresses guaranteed to have valid checksums

2. **For wallet connect errors**:
   - Check that wallet address is properly formatted
   - Ensure address starts with `EQ` (bounceable) or `UQ` (non-bounceable)
   - Backend now validates addresses before processing: returns 400 error instead of crashing

**Test the fix**:
```bash
# Start backend
cd backend && npm run dev

# In another terminal, test invalid address handling
curl -X POST http://localhost:3001/api/tonconnect \
  -H "Content-Type: application/json" \
  -d '{"appName":"test","walletAddress":"INVALID"}'

# Should return: {"error":"Invalid TON wallet address."}
```

---

### "Cannot find module .../vanityWorker.js"

**Symptom**: Backend crashes on startup or when starting generation.

**Cause**: Worker file path resolution mismatch between TypeScript (dev) and JavaScript (production).

**Solution**: Updated in latest version - backend now auto-detects runtime:

```typescript
// Checks if running in ts-node or compiled JS
const isTsRuntime = __filename.endsWith('.ts');

// Loads correct file extension with proper loader
const workerPath = path.resolve(
  __dirname,
  isTsRuntime ? './workers/vanityWorker.ts' : './workers/vanityWorker.js'
);

if (isTsRuntime) {
  options.execArgv = ['-r', 'ts-node/register'];
}
```

**Verify fix**:
```bash
cd backend

# Development mode (TypeScript)
npm run dev  # Should start without errors

# Production mode (JavaScript)
npm run build
node dist/index.js  # Should start without errors
```

---

### "Buffer is not defined"

**Symptom**: Blank screen in frontend, browser console shows `ReferenceError: Buffer is not defined`.

**Cause**: TON libraries (`@ton/ton`, `@ton/crypto`) use Node.js modules that don't exist in browsers.

**Solution**: Frontend now includes polyfills:

1. **Installed packages**:
   ```bash
   npm install buffer
   ```

2. **Created polyfills.ts**:
   ```typescript
   import { Buffer } from 'buffer';
   (globalThis as any).Buffer = Buffer;
   (globalThis as any).process = { env: {}, ... };
   ```

3. **Updated main.tsx**:
   ```typescript
   import './polyfills'  // MUST be first import
   import React from 'react'
   import ReactDOM from 'react-dom/client'
   import App from './App.tsx'
   ```

4. **Updated vite.config.ts**:
   ```typescript
   define: {
     global: 'globalThis',
   },
   resolve: {
     alias: {
       buffer: 'buffer',
     }
   }
   ```

**Verify fix**:
```bash
cd frontend
npm run dev
# Open http://localhost:5174 - should show UI, not blank screen
```

---

### "EADDRINUSE: address already in use :::3001"

**Symptom**: Backend won't start, port 3001 already occupied.

**Cause**: Previous backend process still running.

**Solution**:
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in backend/src/index.ts:
const PORT = process.env.PORT || 3002;
```

---

### Blank/Black UI Screen

**Symptom**: Frontend loads but shows nothing, just blank black screen.

**Causes & Solutions**:

1. **CSS conflicts (index.css)**:
   ```css
   /* BAD - breaks layout */
   body {
     display: flex;
     place-items: center;
   }
   
   /* GOOD */
   body {
     margin: 0;
     min-height: 100vh;
   }
   ```

2. **JavaScript errors**: Check browser console for errors
   - Most common: Buffer undefined → add polyfills
   - Component crashes → check component error boundaries

3. **WebSocket connection failure**:
   ```typescript
   // Check SOCKET_URL matches backend
   const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
   ```

**Debug steps**:
```bash
# 1. Check if React is mounting
# Add temporary debug code to main.tsx:
console.log('React mounting...');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ color: 'white' }}>App Loading...</div>
    <App />
  </React.StrictMode>
);

# 2. Check browser console for errors
# 3. Check backend is running: http://localhost:3001
# 4. Check Socket.IO connection in Network tab
```

---

### Generation Never Completes

**Symptom**: Progress bar runs indefinitely, never finds address.

**Causes**:

1. **Pattern too difficult**:
   - 6-character patterns can take days
   - Case-sensitive dramatically increases difficulty
   - Solution: Use shorter patterns (3-4 chars) or case-insensitive

2. **Case sensitivity confusion**:
   ```typescript
   // TON addresses use base64url: A-Za-z0-9_-
   // "BONK" ≠ "bonk" when case-sensitive
   // Most users should disable case-sensitive
   ```

3. **Invalid pattern characters**:
   - Only use: A-Z, a-z, 0-9, _ (underscore), - (hyphen)
   - Other chars will never match

**Expected times** (@ 100k addresses/sec):
- 3 chars: seconds
- 4 chars: minutes
- 5 chars: hours
- 6 chars: days

---

### Slow Generation Speed

**Symptom**: Only generating 1k-5k addresses/second.

**Causes & Solutions**:

1. **CPU throttling**:
   - Close other apps/browser tabs
   - Ensure laptop plugged in (not on battery)
   - Check Activity Monitor/Task Manager

2. **Insufficient workers**:
   ```typescript
   // Increase in backend/src/index.ts
   const NUM_WORKERS = 8; // Match CPU core count
   ```

3. **Debug mode overhead**:
   ```bash
   # Development mode is slower
   npm run dev  # ~50% speed
   
   # Production mode is faster
   npm run build && node dist/index.js  # 100% speed
   ```

---

### TypeScript Compilation Errors

**Symptom**: `npm run build` fails with type errors.

**Common issues**:

1. **Missing closing brace**:
   ```typescript
   // BAD
   interface Foo {
     bar: string;
   
   interface Baz {  // Missing `}` above
     qux: string;
   }
   
   // GOOD
   interface Foo {
     bar: string;
   }
   
   interface Baz {
     qux: string;
   }
   ```

2. **Import errors**:
   ```bash
   # Solution: Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Version mismatches**:
   ```bash
   # Check Node.js version
   node --version  # Should be 18+
   
   # Check TypeScript version
   npx tsc --version  # Should be 5.x
   ```

---

### Worker Thread Crashes

**Symptom**: Backend logs show worker errors, generation stops.

**Debug**:
```bash
# Check worker logs
tail -f backend/logs/workers.log

# Common causes:
# 1. Out of memory - reduce NUM_WORKERS
# 2. Invalid pattern - validate input
# 3. Malformed wallet code - use official contracts (fixed in latest)
```

**Solution**:
Latest version includes try-catch in worker loop:
```typescript
try {
  // Generate address
} catch (error) {
  console.error(`Worker error:`, error);
  attempts++; // Continue despite errors
}
```

---

### Socket.IO Connection Failures

**Symptom**: Frontend shows "Disconnected" or events don't fire.

**Debug**:
```javascript
// Add to App.tsx useEffect
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});
```

**Common causes**:
1. Backend not running → Start backend
2. CORS issue → Check backend CORS config
3. Wrong URL → Verify SOCKET_URL matches backend port
4. Firewall blocking WebSocket → Check firewall settings

---

## Getting Help

1. **Check browser console** for JavaScript errors
2. **Check backend logs** for server errors
3. **Search existing issues** on GitHub
4. **Create new issue** with:
   - Error message
   - Steps to reproduce
   - Browser/Node.js versions
   - OS (Mac/Windows/Linux)

## Debugging Checklist

- [ ] Backend running on port 3001
- [ ] Frontend running on port 5174 (or 5173)
- [ ] No errors in browser console
- [ ] No errors in backend terminal
- [ ] Socket.IO connected (check Network tab)
- [ ] Pattern is valid (A-Z, a-z, 0-9, _, -)
- [ ] Pattern length 3-6 characters
- [ ] All dependencies installed (`npm install`)
- [ ] TypeScript compiled (`npm run build`)
