export interface VanityRequest {
  pattern: string;
  type: 'prefix' | 'suffix' | 'contains';
  caseSensitive: boolean;
  walletType: 'v4r2' | 'simple';
  tokenConfig?: {
    name: string;
    symbol: string;
    totalSupply: string;
    decimals: number;
  };

export interface TonConnectRequest {
  appName: string;
  walletAddress: string;
}
}

export interface GenerationProgress {
  attempts: number;
  attemptsPerSecond: number;
  estimatedTimeSeconds: number | null;
  status: 'running' | 'found' | 'stopped' | 'error';
}

export interface VanityResult {
  address: string;
  publicKey: string;
  secretKey: string; // hex
  walletType: 'v4r2' | 'simple';
  pattern: string;
  attempts: number;
  timeTaken: number;
}

export interface WorkerMessage {
  type: 'progress' | 'found' | 'error';
  data: any;
  workerId: number;
}