import type { Request, Response } from 'express';
import { Address } from '@ton/core';
import { sha256 } from '@ton/crypto';
import crypto from 'crypto';

/**
 * Generate a random seed and create a TON address
 */
function generateRandomAddress(): string {
  const randomBytes = crypto.randomBytes(32);
  const hash = sha256(randomBytes);
  // Format: workchain:address (0 = basechain)
  const hashHex = Buffer.isBuffer(hash) ? hash.toString('hex') : hash;
  return `0:${hashHex}`;
}

/**
 * Convert address to friendly format (bounceable)
 */
function toFriendlyAddress(rawAddress: string): string {
  try {
    const address = Address.parseRaw(rawAddress);
    return address.toString({
      bounceable: true,
      urlSafe: true,
    });
  } catch (e) {
    return rawAddress;
  }
}

/**
 * Check if address matches the prefix (case-insensitive)
 */
function matchesPrefix(address: string, prefix: string): boolean {
  const normalizedAddress = address.toUpperCase().replace('-', '');
  const normalizedPrefix = prefix.toUpperCase().replace('-', '');
  return normalizedAddress.includes(normalizedPrefix);
}

export const generateVanityAddress = async (req: Request, res: Response) => {
  const { prefix } = req.body;

  // Validation
  if (!prefix || typeof prefix !== 'string') {
    return res.status(400).json({ 
      success: false,
      error: 'Prefix is required and must be a string' 
    });
  }

  const cleanPrefix = prefix.trim().toUpperCase();

  if (cleanPrefix.length === 0) {
    return res.status(400).json({ 
      success: false,
      error: 'Prefix cannot be empty' 
    });
  }

  if (cleanPrefix.length > 10) {
    return res.status(400).json({ 
      success: false,
      error: 'Prefix must be 10 characters or less' 
    });
  }

  // Only allow alphanumeric characters
  if (!/^[A-Z0-9]+$/.test(cleanPrefix)) {
    return res.status(400).json({ 
      success: false,
      error: 'Prefix must contain only alphanumeric characters' 
    });
  }

  try {
    let address: string;
    let friendlyAddress: string;
    let attempts = 0;
    const maxAttempts = 1000000; // Prevent infinite loops

    // Generate addresses until we find one matching the prefix
    do {
      address = generateRandomAddress();
      friendlyAddress = toFriendlyAddress(address);
      attempts++;

      if (matchesPrefix(friendlyAddress, cleanPrefix)) {
        return res.json({
          success: true,
          address: friendlyAddress,
          rawAddress: address,
          prefix: cleanPrefix,
          attempts,
        });
      }

      // Check every 1000 attempts if needed
      if (attempts >= maxAttempts) {
        console.warn(`Max attempts (${maxAttempts}) reached for prefix: ${cleanPrefix}`);
        return res.status(500).json({
          success: false,
          error: 'Could not generate matching address within reasonable time. Try a shorter prefix.',
        });
      }
    } while (true);
  } catch (error) {
    console.error('Error generating vanity address:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating address',
    });
  }
};