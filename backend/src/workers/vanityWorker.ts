import { parentPort } from 'worker_threads';
import { randomBytes } from 'crypto';
import { KeyPair, keyPairFromSeed } from '@ton/crypto';
import { beginCell, Cell, contractAddress, StateInit } from '@ton/core';

// Wallet V4R2 code (simplified - in production use actual compiled code)
const WALLET_V4R2_CODE = Cell.fromBase64('te6cckEBBQEA5QABFP8A4K4Xw4kT/wRRBBHCHwCAzHgXPIQJcwA8Kx8Dy4IQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQ');

// Simple wallet code (simplified)
const SIMPLE_WALLET_CODE = Cell.fromBase64('te6cckEBBgEAUwABFP8A4K4Xw4kT/wRRBBHCHwCAzHgXPIQJcwA8Kx8Dy4IQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQPPIQJcwA8Kx8BIYJcwA8Kx8Dy4IQJcwA8Kx8B4IIJcwA8Kx8D4IQJcwA8Kx8Aw4IQJcwA8Kx8CggglyAPLH8AAgBCHwCBAQ');

interface WorkerData {
  pattern: string;
  type: 'prefix' | 'suffix' | 'contains';
  caseSensitive: boolean;
  walletType: 'v4r2' | 'simple';
  workerId: number;
  startNonce: number;
}

function checkPattern(address: string, pattern: string, type: 'prefix' | 'suffix' | 'contains', caseSensitive: boolean): boolean {
  const addr = caseSensitive ? address : address.toLowerCase();
  const pat = caseSensitive ? pattern : pattern.toLowerCase();
  
  switch (type) {
    case 'prefix':
      return addr.startsWith(pat);
    case 'suffix':
      return addr.endsWith(pat);
    case 'contains':
      return addr.includes(pat);
    default:
      return false;
  }
}

function createWalletStateInit(keyPair: KeyPair, walletType: 'v4r2' | 'simple'): StateInit {
  if (walletType === 'v4r2') {
    // Wallet V4R2 state init
    const data = beginCell()
      .storeUint(0, 32) // seqno
      .storeUint(0, 32) // wallet ID
      .storeBuffer(keyPair.publicKey, 32)
      .storeDict(null) // plugins
      .endCell();
    
    return { code: WALLET_V4R2_CODE, data };
  } else {
    // Simple wallet state init
    const data = beginCell()
      .storeBuffer(keyPair.publicKey, 32)
      .storeUint(0, 32) // seqno
      .endCell();
    
    return { code: SIMPLE_WALLET_CODE, data };
  }
}

function generateVanity(workerData: WorkerData): { address: string; publicKey: string; secretKey: string; attempts: number } | null {
  const { pattern, type, caseSensitive, walletType, startNonce } = workerData;
  
  let attempts = 0;
  const batchSize = 1000;
  const maxAttempts = 10000000; // 10M attempts per worker
  
  while (attempts < maxAttempts) {
    // Generate random seed
    const seed = randomBytes(32);
    const keyPair = keyPairFromSeed(seed);
    
    // Create state init
    const stateInit = createWalletStateInit(keyPair, walletType);
    
    // Calculate address (workchain 0)
    const address = contractAddress(0, stateInit);
    const addressString = address.toString({ bounceable: true, urlSafe: true });
    
    // Check pattern
    if (checkPattern(addressString, pattern, type, caseSensitive)) {
      return {
        address: addressString,
        publicKey: keyPair.publicKey.toString('hex'),
        secretKey: keyPair.secretKey.toString('hex'),
        attempts: attempts + startNonce
      };
    }
    
    attempts++;
    
    // Report progress every batch
    if (attempts % batchSize === 0) {
      parentPort?.postMessage({
        type: 'progress',
        data: { attempts: batchSize },
        workerId: workerData.workerId
      });
    }
  }
  
  return null;
}

if (!parentPort) {
  throw new Error('This script must be run as a worker thread');
}

parentPort.on('message', (workerData: WorkerData) => {
  const result = generateVanity(workerData);
  
  if (result) {
    parentPort?.postMessage({
      type: 'found',
      data: result,
      workerId: workerData.workerId
    });
  } else {
    parentPort?.postMessage({
      type: 'progress',
      data: { attempts: 10000000, exhausted: true },
      workerId: workerData.workerId
    });
  }
});