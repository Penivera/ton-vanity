import { parentPort } from 'worker_threads';
import { randomBytes } from 'crypto';
import { KeyPair, keyPairFromSeed } from '@ton/crypto';
import { Address } from '@ton/core';
import { WalletContractV4, WalletContractV3R2 } from '@ton/ton';

/**
 * TON Vanity Address Generator Worker
 * 
 * This worker generates TON wallet addresses with custom patterns.
 * It uses proper TON wallet contracts (V4R2 or V3R2) to ensure 
 * generated addresses have valid CRC32C checksums.
 * 
 * Pattern matching:
 * - prefix: Pattern appears at start of address (after EQ or UQ)
 * - suffix: Pattern appears at end of address
 * - contains: Pattern appears anywhere in address
 * 
 * Address Format:
 * TON addresses are base64url encoded with CRC32C checksum.
 * Format: EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * - EQ prefix indicates bounceable address
 * - UQ prefix indicates non-bounceable address
 * 
 * Performance:
 * - Each worker can test ~10-50k addresses/second depending on CPU
 * - Pattern difficulty increases exponentially with length
 * - 3 chars: seconds, 4 chars: minutes, 5 chars: hours, 6 chars: days
 */

interface WorkerData {
  pattern: string;
  type: 'prefix' | 'suffix' | 'contains';
  caseSensitive: boolean;
  walletType: 'v4r2' | 'simple';
  workerId: number;
  startNonce: number;
}

/**
 * Checks if an address matches the pattern according to the specified type.
 * 
 * @param address - The full TON address string (e.g., EQAbc123...)
 * @param pattern - The pattern to search for
 * @param type - Where to look for the pattern
 * @param caseSensitive - Whether matching should be case-sensitive
 * @returns true if pattern matches, false otherwise
 */
function checkPattern(
  address: string, 
  pattern: string, 
  type: 'prefix' | 'suffix' | 'contains', 
  caseSensitive: boolean
): boolean {
  const addr = caseSensitive ? address : address.toLowerCase();
  const pat = caseSensitive ? pattern : pattern.toLowerCase();
  
  // Remove EQ/UQ prefix for prefix matching (user wants pattern after the prefix)
  const addressBody = type === 'prefix' ? addr.slice(2) : addr;
  
  switch (type) {
    case 'prefix':
      return addressBody.startsWith(pat);
    case 'suffix':
      return addr.endsWith(pat);
    case 'contains':
      return addr.includes(pat);
    default:
      return false;
  }
}

/**
 * Creates a TON wallet contract instance with the given keypair.
 * Uses official wallet implementations to ensure valid address generation.
 * 
 * @param keyPair - The public/private keypair for the wallet
 * @param walletType - Type of wallet contract to create
 * @returns Wallet contract instance
 */
function createWallet(keyPair: KeyPair, walletType: 'v4r2' | 'simple') {
  if (walletType === 'v4r2') {
    // Wallet V4R2 - Latest standard wallet with plugins support
    return WalletContractV4.create({ 
      workchain: 0, 
      publicKey: keyPair.publicKey 
    });
  } else {
    // Wallet V3R2 - Widely compatible legacy wallet
    return WalletContractV3R2.create({ 
      workchain: 0, 
      publicKey: keyPair.publicKey 
    });
  }
}

/**
 * Generates vanity TON wallet addresses by brute force.
 * Continuously generates random keypairs until finding an address
 * matching the desired pattern.
 * 
 * Process:
 * 1. Generate random 32-byte seed
 * 2. Derive ED25519 keypair from seed
 * 3. Create wallet contract with keypair
 * 4. Get address from wallet contract (includes proper CRC32C)
 * 5. Check if address matches pattern
 * 6. If match found, return address and keys
 * 7. Otherwise, repeat from step 1
 * 
 * @param workerData - Configuration for pattern matching and wallet type
 * @returns Found address with keys, or null if max attempts exceeded
 */
function generateVanity(workerData: WorkerData): { 
  address: string; 
  publicKey: string; 
  secretKey: string; 
  attempts: number 
} | null {
  const { pattern, type, caseSensitive, walletType, startNonce } = workerData;
  
  let attempts = 0;
  const batchSize = 1000; // Progress report interval
  const maxAttempts = 10000000; // 10M attempts per worker before giving up
  
  while (attempts < maxAttempts) {
    try {
      // Generate random seed (32 bytes of cryptographic entropy)
      const seed = randomBytes(32);
      const keyPair = keyPairFromSeed(seed);
      
      // Create wallet contract with proper code and data
      // This ensures addresses have valid CRC32C checksums
      const wallet = createWallet(keyPair, walletType);
      
      // Get the wallet's address (guaranteed valid CRC32C)
      const address = wallet.address;
      const addressString = address.toString({ 
        bounceable: true,  // Bounceable (EQ prefix) for safety
        urlSafe: true      // URL-safe base64 encoding
      });
      
      // Check if address matches pattern
      if (checkPattern(addressString, pattern, type, caseSensitive)) {
        // MATCH FOUND!
        return {
          address: addressString,
          publicKey: keyPair.publicKey.toString('hex'),
          secretKey: keyPair.secretKey.toString('hex'),
          attempts: attempts + startNonce
        };
      }
      
      attempts++;
      
      // Report progress every batch to keep UI responsive
      if (attempts % batchSize === 0) {
        parentPort?.postMessage({
          type: 'progress',
          data: { attempts: batchSize },
          workerId: workerData.workerId
        });
      }
    } catch (error) {
      // Log but continue on any generation error
      // This prevents worker crashes from malformed data
      console.error(`Worker ${workerData.workerId} generation error:`, error);
      attempts++;
    }
  }
  
  // Max attempts reached without finding match
  return null;
}

// Worker thread entry point
if (!parentPort) {
  throw new Error('This script must be run as a worker thread');
}

parentPort.on('message', (workerData: WorkerData) => {
  console.log(`Worker ${workerData.workerId} starting: looking for ${workerData.type} "${workerData.pattern}" in ${workerData.walletType} wallet`);
  
  const result = generateVanity(workerData);
  
  if (result) {
    console.log(`Worker ${workerData.workerId} SUCCESS: Found address ${result.address} after ${result.attempts} attempts`);
    parentPort?.postMessage({
      type: 'found',
      data: result,
      workerId: workerData.workerId
    });
  } else {
    console.log(`Worker ${workerData.workerId} exhausted: Gave up after ${10000000} attempts`);
    parentPort?.postMessage({
      type: 'progress',
      data: { attempts: 10000000, exhausted: true },
      workerId: workerData.workerId
    });
  }
});
