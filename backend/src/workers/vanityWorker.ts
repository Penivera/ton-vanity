import type { Request, Response } from 'express';
import crypto from 'crypto';

/**
 * Generate a simple vanity address
 * Format: EQ + base64url-like string
 */
function generateRandomAddress(): string {
  const randomBytes = crypto.randomBytes(32);
  const base64 = randomBytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `EQ${base64}`;
}

/**
 * Check if address matches the prefix (case-insensitive)
 */
function matchesPrefix(address: string, prefix: string): boolean {
  const normalizedAddress = address.toUpperCase();
  const normalizedPrefix = prefix.toUpperCase();
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
    let attempts = 0;
    const maxAttempts = 1000000; // Prevent infinite loops

    // Generate addresses until we find one matching the prefix
    do {
      address = generateRandomAddress();
      attempts++;

      if (matchesPrefix(address, cleanPrefix)) {
        return res.json({
          success: true,
          address: address,
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