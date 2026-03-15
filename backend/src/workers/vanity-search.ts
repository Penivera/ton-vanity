import { Address, beginCell, Cell, contractAddress } from '@ton/core';
import { MatchType, VanityNetwork } from '../vanity/entities/vanity-generation.entity';
import {
  DEFAULT_TARGET_ADDRESS_KIND,
  TargetAddressKind,
  TokenVanityConfig,
} from '../vanity/types/generation-metadata';

const PROXY_CODE_BOC =
  'te6cckEBAgEAQAABFP8A9KQT9LzyyAsBAGLTMwGCCJiWgLmRW+DQ0wMwcbCRMODtRND6QDBwgBDIywVYzxYh+gLLagHPFsmAQPsA9B+UgA==';

export interface VanitySearchInput {
  pattern: string;
  matchType: MatchType;
  targetAddress?: string;
  targetKind?: TargetAddressKind;
  tokenConfig?: TokenVanityConfig;
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

function decodeBocCell(name: string, bocBase64: string): Cell {
  let cells: Cell[];

  try {
    cells = Cell.fromBoc(Buffer.from(bocBase64, 'base64'));
  } catch {
    throw new Error(`${name} is not a valid BOC`);
  }

  if (cells.length === 0) {
    throw new Error(`${name} BOC did not contain a root cell`);
  }

  return cells[0];
}

function buildAddressResolver(input: VanitySearchInput): (salt: bigint) => Address {
  const targetKind = input.targetKind ?? DEFAULT_TARGET_ADDRESS_KIND;

  if (targetKind === TargetAddressKind.TOKEN) {
    const tokenConfig = input.tokenConfig;

    if (!tokenConfig) {
      throw new Error('Missing tokenConfig for token target kind');
    }

    const masterCodeCell = decodeBocCell('tokenMasterCodeBoc', tokenConfig.tokenMasterCodeBoc);
    const walletCodeCell = decodeBocCell('tokenWalletCodeBoc', tokenConfig.tokenWalletCodeBoc);
    const adminAddress = Address.parse(tokenConfig.tokenAdminAddress);
    const contentCell = tokenConfig.tokenContentCellBoc
      ? decodeBocCell('tokenContentCellBoc', tokenConfig.tokenContentCellBoc)
      : beginCell().storeUint(0, 8).endCell();

    const totalSupply = tokenConfig.tokenTotalSupply ? BigInt(tokenConfig.tokenTotalSupply) : 0n;

    return (salt: bigint) => {
      // Standard Jetton data fields are preserved; the trailing salt adds address entropy.
      const dataCell = beginCell()
        .storeCoins(totalSupply)
        .storeAddress(adminAddress)
        .storeRef(contentCell)
        .storeRef(walletCodeCell)
        .storeUint(salt, 64)
        .endCell();

      return contractAddress(0, {
        code: masterCodeCell,
        data: dataCell,
      });
    };
  }

  if (!input.targetAddress) {
    throw new Error('targetAddress is required for wallet/contract target kinds');
  }

  const parsedTargetAddress = Address.parse(input.targetAddress);
  const proxyCodeCell = Cell.fromBoc(Buffer.from(PROXY_CODE_BOC, 'base64'))[0];

  return (salt: bigint) => {
    const proxyDataCell = beginCell().storeAddress(parsedTargetAddress).storeUint(salt, 64).endCell();
    return contractAddress(0, {
      code: proxyCodeCell,
      data: proxyDataCell,
    });
  };
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
  const resolveAddress = buildAddressResolver(input);
  const isTestnet = input.network === VanityNetwork.TESTNET;
  const normalizedPattern = input.pattern.trim().toUpperCase();

  let attempts = 0;
  let salt = BigInt(Math.floor(Math.random() * 1_000_000_000));

  while (true) {
    for (let i = 0; i < 10000; i += 1) {
      salt += 1n;
      attempts += 1;

      const address = resolveAddress(salt);

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
