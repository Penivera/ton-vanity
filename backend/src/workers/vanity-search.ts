import { Address, beginCell, Cell, contractAddress } from '@ton/core';
import { MatchType, VanityNetwork } from '../vanity/entities/vanity-generation.entity';

const PROXY_CODE_BOC =
  'te6cckEBAgEAQAABFP8A9KQT9LzyyAsBAGLTMwGCCJiWgLmRW+DQ0wMwcbCRMODtRND6QDBwgBDIywVYzxYh+gLLagHPFsmAQPsA9B+UgA==';

export interface VanitySearchInput {
  pattern: string;
  matchType: MatchType;
  targetAddress: string;
  network: VanityNetwork;
}

export interface VanitySearchResult {
  address: string;
  rawAddress: string;
  salt: string;
  attempts: number;
}

export interface VanitySearchCallbacks {
  onProgress?: (attempts: number) => Promise<void> | void;
  shouldStop?: () => Promise<boolean> | boolean;
}

function matchesPattern(addressString: string, pattern: string, matchType: MatchType): boolean {
  const normalizedAddress = addressString.toUpperCase();
  const normalizedPattern = pattern.toUpperCase();

  if (matchType === MatchType.PREFIX) {
    return normalizedAddress.substring(2).startsWith(normalizedPattern);
  }

  if (matchType === MatchType.SUFFIX) {
    return normalizedAddress.endsWith(normalizedPattern);
  }

  return normalizedAddress.includes(normalizedPattern);
}

export async function runVanitySearch(
  input: VanitySearchInput,
  callbacks: VanitySearchCallbacks = {},
): Promise<VanitySearchResult> {
  const parsedTargetAddress = Address.parse(input.targetAddress);
  const proxyCodeCell = Cell.fromBoc(Buffer.from(PROXY_CODE_BOC, 'base64'))[0];
  const isTestnet = input.network === VanityNetwork.TESTNET;
  const normalizedPattern = input.pattern.trim().toUpperCase();

  let attempts = 0;
  let salt = BigInt(Math.floor(Math.random() * 1_000_000_000));

  while (true) {
    for (let i = 0; i < 10000; i += 1) {
      salt += 1n;
      attempts += 1;

      const proxyDataCell = beginCell().storeAddress(parsedTargetAddress).storeUint(salt, 64).endCell();
      const address = contractAddress(0, {
        code: proxyCodeCell,
        data: proxyDataCell,
      });

      const addressString = address.toString({ bounceable: true, testOnly: isTestnet, urlSafe: true });

      if (matchesPattern(addressString, normalizedPattern, input.matchType)) {
        return {
          address: addressString,
          rawAddress: address.toRawString(),
          salt: salt.toString(),
          attempts,
        };
      }
    }

    if (callbacks.onProgress) {
      await callbacks.onProgress(attempts);
    }

    if (callbacks.shouldStop && (await callbacks.shouldStop())) {
      throw new Error('Generation stopped');
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
