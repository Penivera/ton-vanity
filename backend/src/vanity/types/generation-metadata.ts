export enum TargetAddressKind {
  WALLET = 'wallet',
  CONTRACT = 'contract',
  TOKEN = 'token',
}

export const DEFAULT_TARGET_ADDRESS_KIND = TargetAddressKind.CONTRACT;

export interface TokenVanityConfig {
  tokenMasterCodeBoc: string;
  tokenWalletCodeBoc: string;
  tokenAdminAddress: string;
  tokenContentCellBoc?: string;
  tokenTotalSupply?: string;
}

export interface GenerationMetadata {
  targetAddress?: string;
  targetKind: TargetAddressKind;
  tokenConfig?: TokenVanityConfig;
}
