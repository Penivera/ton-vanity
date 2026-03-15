import type { Request, Response } from 'express';
import { MatchType, VanityNetwork } from '../vanity/entities/vanity-generation.entity';
// Using the local IO server emitting
import { getIO } from '../index'; // We will export the io instance in index.ts
import {
  DEFAULT_TARGET_ADDRESS_KIND,
  TargetAddressKind,
  TokenVanityConfig,
} from '../vanity/types/generation-metadata';
import { runVanitySearch } from './vanity-search';

function matchesPatternInput(matchType: unknown): matchType is MatchType {
  return matchType === MatchType.PREFIX || matchType === MatchType.SUFFIX || matchType === MatchType.CONTAINS;
}

function normalizeNetwork(network: unknown): VanityNetwork {
  return network === VanityNetwork.TESTNET ? VanityNetwork.TESTNET : VanityNetwork.MAINNET;
}

function isLikelyValidationError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes('required') ||
    text.includes('invalid') ||
    text.includes('must be') ||
    text.includes('missing') ||
    text.includes('boc')
  );
}

function buildTokenConfig(body: Request['body']): TokenVanityConfig {
  return {
    tokenMasterCodeBoc: body.tokenMasterCodeBoc,
    tokenWalletCodeBoc: body.tokenWalletCodeBoc,
    tokenAdminAddress: body.tokenAdminAddress,
    tokenContentCellBoc: body.tokenContentCellBoc,
    tokenTotalSupply: body.tokenTotalSupply,
  };
}

export const generateVanityAddress = async (req: Request, res: Response) => {
  const {
    prefix,
    matchType = MatchType.PREFIX,
    targetAddress,
    targetKind = DEFAULT_TARGET_ADDRESS_KIND,
    socketId,
    network,
  } = req.body;

  if (!prefix || typeof prefix !== 'string') {
    return res.status(400).json({ success: false, error: 'Prefix is required and must be a string' });
  }

  if (!Object.values(TargetAddressKind).includes(targetKind)) {
    return res.status(400).json({
      success: false,
      error: `targetKind must be one of: ${Object.values(TargetAddressKind).join(', ')}`,
    });
  }

  if (!matchesPatternInput(matchType)) {
    return res.status(400).json({ success: false, error: 'matchType must be one of: prefix, suffix, contains' });
  }

  const cleanPrefix = prefix.trim().toUpperCase();
  const normalizedNetwork = normalizeNetwork(network);

  if (cleanPrefix.length === 0) {
    return res.status(400).json({ success: false, error: 'Prefix cannot be empty' });
  }

  if (cleanPrefix.length > 10) {
    return res.status(400).json({ success: false, error: 'Prefix must be 10 characters or less' });
  }

  if (!/^[A-Z0-9]+$/.test(cleanPrefix)) {
    return res.status(400).json({ success: false, error: 'Prefix must contain only alphanumeric characters' });
  }

  if (targetKind !== TargetAddressKind.TOKEN && (!targetAddress || typeof targetAddress !== 'string')) {
    return res.status(400).json({ success: false, error: 'Target Address is required for wallet/contract mode' });
  }

  if (targetKind === TargetAddressKind.TOKEN) {
    if (
      !req.body.tokenMasterCodeBoc ||
      !req.body.tokenWalletCodeBoc ||
      !req.body.tokenAdminAddress ||
      typeof req.body.tokenMasterCodeBoc !== 'string' ||
      typeof req.body.tokenWalletCodeBoc !== 'string' ||
      typeof req.body.tokenAdminAddress !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Token mode requires tokenMasterCodeBoc, tokenWalletCodeBoc, and tokenAdminAddress to derive a Jetton master vanity address.',
      });
    }
  }

  const startTime = Date.now();
  const TIMEOUT_MS = 24000;
  let backgroundMode = false;

  try {
    const searchPromise = runVanitySearch(
      {
        pattern: cleanPrefix,
        matchType,
        targetAddress,
        targetKind,
        tokenConfig: targetKind === TargetAddressKind.TOKEN ? buildTokenConfig(req.body) : undefined,
        network: normalizedNetwork,
      },
      {
        onProgress: async () => {
          if (!backgroundMode && Date.now() - startTime > TIMEOUT_MS) {
            backgroundMode = true;
            res.json({
              success: true,
              status: 'processing',
              targetKind,
              network: normalizedNetwork,
              message: 'Generation taking longer than expected. Continuing in background...',
            });
          }
        },
      },
    );

    searchPromise
      .then((result) => {
        const payload = {
          success: true,
          address: result.address,
          rawAddress: result.rawAddress,
          prefix: cleanPrefix,
          matchType,
          targetKind,
          network: normalizedNetwork,
          attempts: result.attempts,
          salt: result.salt,
          targetAddress,
        };

        if (!backgroundMode) {
          return res.json(payload);
        }

        const io = getIO();
        if (io && socketId) {
          io.to(socketId).emit('vanityFound', payload);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';

        if (!backgroundMode) {
          return res.status(isLikelyValidationError(message) ? 400 : 500).json({ success: false, error: message });
        }

        const io = getIO();
        if (io && socketId) {
          io.to(socketId).emit('vanityFound', { success: false, error: message, targetKind });
        }
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(isLikelyValidationError(message) ? 400 : 500).json({ success: false, error: message });
  }
};
