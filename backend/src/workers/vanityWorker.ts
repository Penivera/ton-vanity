import type { Request, Response } from 'express';
import { Address, beginCell, Cell, StateInit, contractAddress } from '@ton/core';
// Using the local IO server emitting
import { getIO } from '../index'; // We will export the io instance in index.ts

type MatchType = 'prefix' | 'suffix' | 'contains';
type VanityNetwork = 'mainnet' | 'testnet';

const PROXY_CODE_BOC = 'te6cckEBAgEAQAABFP8A9KQT9LzyyAsBAGLTMwGCCJiWgLmRW+DQ0wMwcbCRMODtRND6QDBwgBDIywVYzxYh+gLLagHPFsmAQPsA9B+UgA==';

function matchesPattern(addressString: string, prefix: string, matchType: MatchType): boolean {
  const normalizedAddress = addressString.toUpperCase();
  const normalizedPrefix = prefix.toUpperCase();

  if (matchType === 'prefix') {
    // TON addresses typically start with EQ or UQ. We check after the first 2 chars.
    // Or we simply check the whole 48 character encoded string.
    // e.g. EQxyz... => length 48
    // We'll just check the base64 part, skipping the first 2 characters 'EQ'/'UQ'
    const base64Part = normalizedAddress.substring(2);
    if (matchType === 'prefix') return base64Part.startsWith(normalizedPrefix);
  }

  if (matchType === 'suffix') {
    return normalizedAddress.endsWith(normalizedPrefix);
  }

  return normalizedAddress.includes(normalizedPrefix);
}

function normalizeNetwork(network: unknown): VanityNetwork {
  return network === 'testnet' ? 'testnet' : 'mainnet';
}

export const generateVanityAddress = async (req: Request, res: Response) => {
  const { prefix, matchType = 'prefix', targetAddress, socketId, network } = req.body;

  // Validation
  if (!prefix || typeof prefix !== 'string') {
    return res.status(400).json({ success: false, error: 'Prefix is required and must be a string' });
  }

  if (!targetAddress || typeof targetAddress !== 'string') {
    return res.status(400).json({ success: false, error: 'Target Address is required' });
  }

  let parsedTargetAddress: Address;
  try {
    parsedTargetAddress = Address.parse(targetAddress);
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid Target Address format' });
  }

  const cleanPrefix = prefix.trim().toUpperCase();
  const normalizedNetwork = normalizeNetwork(network);
  const isTestnet = normalizedNetwork === 'testnet';

  if (cleanPrefix.length === 0) return res.status(400).json({ success: false, error: 'Prefix cannot be empty' });
  if (cleanPrefix.length > 10) return res.status(400).json({ success: false, error: 'Prefix must be 10 characters or less' });
  if (!/^[A-Z0-9]+$/.test(cleanPrefix)) return res.status(400).json({ success: false, error: 'Prefix must contain only alphanumeric characters' });
  if (!['prefix', 'suffix', 'contains'].includes(matchType)) return res.status(400).json({ success: false, error: 'matchType must be one of: prefix, suffix, contains' });

  const normalizedMatchType = matchType as MatchType;

  // Prepare Proxy Code Cell
  const proxyCodeCell = Cell.fromBoc(Buffer.from(PROXY_CODE_BOC, 'base64'))[0];

  let attempts = 0;
  let salt = BigInt(Math.floor(Math.random() * 1000000000)); // Start with a random salt

  const startTime = Date.now();
  const TIMEOUT_MS = 24000; // 24 seconds (Vercel standard timeout is 30s)
  let backgroundMode = false;

  const searchLoop = () => {
    // We break the event loop periodically so Node isn't completely blocked
    // Larger batches improve throughput for easy patterns while still yielding often enough for HTTP and sockets.
    const batchSize = 10000;
    let batchAttempts = 0;

    while (batchAttempts < batchSize) {
      salt++;
      attempts++;

      // Build Proxy Data Cell:
      // ds~load_msg_addr() -> target_address
      // ds~load_uint(64) -> salt
      const proxyDataCell = beginCell()
        .storeAddress(parsedTargetAddress)
        .storeUint(salt, 64)
        .endCell();

      // Calculate state init address
      // Workchain 0
      const address = contractAddress(0, {
        code: proxyCodeCell,
        data: proxyDataCell
      });

      // Convert to user-friendly bounceable format
      const addressString = address.toString({ bounceable: true, testOnly: isTestnet, urlSafe: true });

      if (matchesPattern(addressString, cleanPrefix, normalizedMatchType)) {
        if (!backgroundMode) {
          // Send HTTP response directly
          return res.json({
            success: true,
            address: addressString,
            rawAddress: address.toRawString(),
            prefix: cleanPrefix,
            matchType: normalizedMatchType,
            network: normalizedNetwork,
            attempts,
            salt: salt.toString(),
            targetAddress
          });
        } else {
          // Already sent HTTP response, pushing result to socket
          const io = getIO();
          if (io && socketId) {
            io.to(socketId).emit('vanityFound', {
              success: true,
              address: addressString,
              rawAddress: address.toRawString(),
              prefix: cleanPrefix,
              matchType: normalizedMatchType,
              network: normalizedNetwork,
              attempts,
              salt: salt.toString(),
              targetAddress
            });
          }
          return;
        }
      }

      batchAttempts++;
    }

    // Check time limit
    if (!backgroundMode && Date.now() - startTime > TIMEOUT_MS) {
      backgroundMode = true;
      res.json({
        success: true,
        status: 'processing',
        network: normalizedNetwork,
        message: 'Generation taking longer than expected. Continuing in background...',
      });
      // We purposefully do NOT return here, instead we schedule the next tick
    }

    // Yield solidly to the event loop so HTTP and Sockets can process
    setTimeout(searchLoop, 0);
  };

  // Start the background loop
  searchLoop();
};