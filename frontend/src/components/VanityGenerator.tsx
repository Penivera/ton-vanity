import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Zap, Copy, Check, AlertCircle, Rocket, ExternalLink, X, Download } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { CHAIN } from '@tonconnect/sdk';
import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { Address, beginCell, Cell, contractAddress, storeStateInit } from '@ton/core';
import type { StateInit } from '@ton/core';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const QUEUE_API_BASE_URL = (import.meta.env.VITE_NEST_API_URL || API_BASE_URL).replace(/\/$/, '');
const PROXY_CODE_BOC = 'te6cckEBAgEAQAABFP8A9KQT9LzyyAsBAGLTMwGCCJiWgLmRW+DQ0wMwcbCRMODtRND6QDBwgBDIywVYzxYh+gLLagHPFsmAQPsA9B+UgA==';

type MatchType = 'prefix' | 'suffix' | 'contains';
type TargetKind = 'wallet' | 'contract' | 'token';

interface TokenDeploymentInput {
  tokenMasterCodeBoc: string;
  tokenWalletCodeBoc: string;
  tokenAdminAddress: string;
  tokenContentCellBoc?: string;
  tokenTotalSupply?: string;
  salt: string;
}

interface VanityFoundEvent {
  success: boolean;
  address?: string;
  salt?: string;
  network?: 'mainnet' | 'testnet';
  targetKind?: TargetKind;
  error?: string;
}

interface QueuedGeneration {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  generatedAddress: string | null;
  generatedSalt: number | null;
  network: 'mainnet' | 'testnet';
  backgroundJobId: string | null;
  errorMessage: string | null;
}

interface TelegramWebAppWindow extends Window {
  Telegram?: {
    WebApp?: {
      initData?: string;
    };
  };
}

interface StoredGenerationMetadata {
  targetAddress?: string;
  targetKind?: TargetKind;
  tokenConfig?: {
    tokenMasterCodeBoc?: string;
    tokenWalletCodeBoc?: string;
    tokenAdminAddress?: string;
    tokenContentCellBoc?: string;
    tokenTotalSupply?: string;
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

const buildTokenDeploymentStateInit = (input: TokenDeploymentInput): { stateInit: StateInit; address: Address } => {
  const masterCodeCell = Cell.fromBoc(Buffer.from(input.tokenMasterCodeBoc, 'base64'))[0];
  const walletCodeCell = Cell.fromBoc(Buffer.from(input.tokenWalletCodeBoc, 'base64'))[0];
  const adminAddress = Address.parse(input.tokenAdminAddress);
  const contentCell = input.tokenContentCellBoc
    ? Cell.fromBoc(Buffer.from(input.tokenContentCellBoc, 'base64'))[0]
    : beginCell().storeUint(0, 8).endCell();
  const totalSupply = input.tokenTotalSupply ? BigInt(input.tokenTotalSupply) : 0n;

  const tokenDataCell = beginCell()
    .storeCoins(totalSupply)
    .storeAddress(adminAddress)
    .storeRef(contentCell)
    .storeRef(walletCodeCell)
    .storeUint(BigInt(input.salt), 64)
    .endCell();

  const stateInit: StateInit = {
    code: masterCodeCell,
    data: tokenDataCell,
  };

  return {
    stateInit,
    address: contractAddress(0, stateInit),
  };
};

const getDifficulty = (text: string, matchType: MatchType): { level: 'Easy' | 'Medium' | 'Hard'; note: string } => {
  const length = text.trim().length;
  if (length <= 2) return { level: 'Easy', note: `${matchType} with short text is usually quick` };
  if (length <= 4) return matchType === 'contains' ? { level: 'Easy', note: 'contains is usually faster' } : { level: 'Medium', note: `${matchType} may take from seconds to minutes` };
  if (length <= 6) return { level: 'Hard', note: 'longer patterns can take significantly more attempts' };
  return { level: 'Hard', note: 'very long patterns may take a long time to find' };
};

const formatAddressForNetwork = (address: string, isTestnet: boolean): string => {
  try {
    return Address.parse(address).toString({
      bounceable: true,
      testOnly: isTestnet,
      urlSafe: true,
    });
  } catch {
    return address;
  }
};

const inferGenerationNetwork = (targetAddress: string, walletChain?: string): 'mainnet' | 'testnet' => {
  if (walletChain === CHAIN.TESTNET) {
    return 'testnet';
  }

  if (walletChain === CHAIN.MAINNET) {
    return 'mainnet';
  }

  const trimmed = targetAddress.trim();
  if (trimmed.startsWith('kQ') || trimmed.startsWith('0Q')) {
    return 'testnet';
  }

  return 'mainnet';
};

const VanityGenerator = () => {
  const [prefix, setPrefix] = useState('');
  const [targetKind, setTargetKind] = useState<TargetKind>('contract');
  const [targetAddress, setTargetAddress] = useState('');
  const [sourceTokenAddress, setSourceTokenAddress] = useState('');
  const [tokenMasterCodeBoc, setTokenMasterCodeBoc] = useState('');
  const [tokenWalletCodeBoc, setTokenWalletCodeBoc] = useState('');
  const [tokenAdminAddress, setTokenAdminAddress] = useState('');
  const [tokenContentCellBoc, setTokenContentCellBoc] = useState('');
  const [tokenTotalSupply, setTokenTotalSupply] = useState('0');
  const [matchType, setMatchType] = useState<MatchType>('prefix');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTokenTemplate, setIsLoadingTokenTemplate] = useState(false);
  const [isExportingPayload, setIsExportingPayload] = useState(false);
  const [isBackground, setIsBackground] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [authState, setAuthState] = useState<'idle' | 'authenticating' | 'ready' | 'unavailable' | 'failed'>('idle');
  const [queuedGenerationId, setQueuedGenerationId] = useState('');

  const [generatedAddress, setGeneratedAddress] = useState('');
  const [generatedSalt, setGeneratedSalt] = useState('');
  const [generatedTargetKind, setGeneratedTargetKind] = useState<TargetKind>('contract');
  const [generatedNetwork, setGeneratedNetwork] = useState<'mainnet' | 'testnet'>('mainnet');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [deployToast, setDeployToast] = useState<{ address: string; network: 'mainnet' | 'testnet' } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const queuePollRef = useRef<number | null>(null);
  const difficulty = getDifficulty(prefix, matchType);

  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const wallet = useTonWallet();
  const walletIsTestnet = wallet?.account.chain === CHAIN.TESTNET;
  const isGeneratedTestnet = generatedNetwork === 'testnet';
  const displayGeneratedAddress = generatedAddress ? formatAddressForNetwork(generatedAddress, isGeneratedTestnet) : '';
  const isTokenMode = targetKind === 'token';

  useEffect(() => {
    if (!deployToast) return;

    const timer = window.setTimeout(() => {
      setDeployToast(null);
    }, 9000);

    return () => window.clearTimeout(timer);
  }, [deployToast]);

  useEffect(() => {
    if (!tokenAdminAddress && userAddress) {
      setTokenAdminAddress(userAddress);
    }
  }, [tokenAdminAddress, userAddress]);

  useEffect(() => {
    const storedToken = localStorage.getItem('vanityJwtToken');
    if (storedToken) {
      setAuthToken(storedToken);
      setAuthState('ready');
      return;
    }

    const telegramWindow = window as TelegramWebAppWindow;
    const initData = telegramWindow.Telegram?.WebApp?.initData?.trim();
    if (!initData) {
      setAuthState('unavailable');
      return;
    }

    setAuthState('authenticating');
    void axios
      .post(`${QUEUE_API_BASE_URL}/auth/telegram`, { initData })
      .then((response) => {
        const token = response.data?.accessToken;
        if (!token || typeof token !== 'string') {
          throw new Error('Missing access token in auth response');
        }

        localStorage.setItem('vanityJwtToken', token);
        setAuthToken(token);
        setAuthState('ready');
      })
      .catch(() => {
        setAuthState('failed');
      });
  }, []);

  const applyGenerationMetadata = (metadataRaw: string | null) => {
    if (!metadataRaw) {
      return;
    }

    try {
      const metadata = JSON.parse(metadataRaw) as StoredGenerationMetadata;
      if (metadata.targetKind) {
        setGeneratedTargetKind(metadata.targetKind);
        setTargetKind(metadata.targetKind);
      }

      if (metadata.targetAddress) {
        setTargetAddress(metadata.targetAddress);
      }

      if (metadata.tokenConfig) {
        if (metadata.tokenConfig.tokenMasterCodeBoc) setTokenMasterCodeBoc(metadata.tokenConfig.tokenMasterCodeBoc);
        if (metadata.tokenConfig.tokenWalletCodeBoc) setTokenWalletCodeBoc(metadata.tokenConfig.tokenWalletCodeBoc);
        if (metadata.tokenConfig.tokenAdminAddress) setTokenAdminAddress(metadata.tokenConfig.tokenAdminAddress);
        if (metadata.tokenConfig.tokenContentCellBoc) setTokenContentCellBoc(metadata.tokenConfig.tokenContentCellBoc);
        if (metadata.tokenConfig.tokenTotalSupply) setTokenTotalSupply(metadata.tokenConfig.tokenTotalSupply);
      }
    } catch {
      // Ignore malformed metadata from old rows.
    }
  };

  const applyQueuedGenerationResult = (generation: QueuedGeneration) => {
    if (generation.generatedAddress) {
      setGeneratedAddress(generation.generatedAddress);
    }
    if (generation.generatedSalt !== null && generation.generatedSalt !== undefined) {
      setGeneratedSalt(String(generation.generatedSalt));
    }

    setGeneratedNetwork(generation.network === 'testnet' ? 'testnet' : 'mainnet');
    applyGenerationMetadata(generation.backgroundJobId);
  };

  const stopQueuePolling = () => {
    if (queuePollRef.current) {
      window.clearInterval(queuePollRef.current);
      queuePollRef.current = null;
    }
  };

  const startQueuePolling = (generationId: string, token: string) => {
    stopQueuePolling();
    queuePollRef.current = window.setInterval(() => {
      void axios
        .get(`${QUEUE_API_BASE_URL}/vanity/generations/${generationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .then((response) => {
          const generation = response.data as QueuedGeneration;

          if (generation.status === 'completed') {
            applyQueuedGenerationResult(generation);
            setQueuedGenerationId(generation.id);
            setIsGenerating(false);
            setIsBackground(false);
            setError('');
            stopQueuePolling();
            return;
          }

          if (generation.status === 'failed' || generation.status === 'cancelled') {
            setIsGenerating(false);
            setIsBackground(false);
            setError(generation.errorMessage || 'Queued generation failed');
            stopQueuePolling();
          }
        })
        .catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            localStorage.removeItem('vanityJwtToken');
            setAuthToken('');
            setAuthState('failed');
            setIsGenerating(false);
            setIsBackground(false);
            setError('Session expired. Reload the app inside Telegram to re-authenticate.');
            stopQueuePolling();
          }
        });
    }, 2000);
  };

  useEffect(() => {
    if (!authToken) {
      return;
    }

    void axios
      .get(`${QUEUE_API_BASE_URL}/vanity/generations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      .then((response) => {
        const generations = response.data as QueuedGeneration[];
        if (!Array.isArray(generations) || generations.length === 0) {
          return;
        }

        const active = generations.find((g) => g.status === 'pending' || g.status === 'running');
        if (active) {
          setQueuedGenerationId(active.id);
          setIsGenerating(true);
          setIsBackground(true);
          startQueuePolling(active.id, authToken);
          return;
        }

        if (generatedAddress) {
          return;
        }

        const latestCompleted = generations.find((g) => g.status === 'completed' && g.generatedAddress && g.generatedSalt !== null);
        if (latestCompleted) {
          setQueuedGenerationId(latestCompleted.id);
          applyQueuedGenerationResult(latestCompleted);
        }
      })
      .catch(() => {
        // Keep direct mode available if queue API is not reachable.
      });
  }, [authToken]);

  useEffect(() => {
    // Initialize socket
    socketRef.current = io(API_BASE_URL || window.location.origin);

    socketRef.current.on('vanityFound', (data: VanityFoundEvent) => {
      if (data.success) {
        setGeneratedAddress(data.address || '');
        setGeneratedSalt(data.salt || '');
        setGeneratedTargetKind(data.targetKind === 'token' ? 'token' : data.targetKind === 'wallet' ? 'wallet' : 'contract');
        setGeneratedNetwork(data.network === 'testnet' ? 'testnet' : 'mainnet');
        setIsGenerating(false);
        setIsBackground(false);
        setError('');
      } else {
        setError(data.error || 'Failed to generate address in background');
        setIsGenerating(false);
        setIsBackground(false);
      }
    });

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (socketRef.current) socketRef.current.disconnect();
      stopQueuePolling();
    };
  }, []);

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setGeneratedAddress('');
    setGeneratedSalt('');
    setGeneratedTargetKind(targetKind);
    setGeneratedNetwork('mainnet');

    if (!prefix.trim()) {
      setError('Please enter a vanity text pattern');
      return;
    }

    if (!isTokenMode && !targetAddress.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (isTokenMode && (!tokenMasterCodeBoc.trim() || !tokenWalletCodeBoc.trim() || !tokenAdminAddress.trim())) {
      setError('Token mode requires master code BOC, wallet code BOC, and admin address');
      return;
    }

    if (isTokenMode && tokenTotalSupply.trim() && !/^\d+$/.test(tokenTotalSupply.trim())) {
      setError('Token total supply must be a non-negative integer');
      return;
    }

    if (prefix.length > 10) {
      setError('Prefix must be 10 characters or less');
      return;
    }

    setIsGenerating(true);
    setIsBackground(false);
    abortControllerRef.current = new AbortController();
    const networkProbeAddress = isTokenMode ? tokenAdminAddress : targetAddress;
    const requestedNetwork = inferGenerationNetwork(networkProbeAddress, wallet?.account.chain);

    try {
      if (authToken) {
        const queueResponse = await axios.post(
          `${QUEUE_API_BASE_URL}/vanity/generate`,
          {
            pattern: prefix,
            matchType,
            targetAddress: isTokenMode ? undefined : targetAddress,
            targetKind,
            tokenMasterCodeBoc: isTokenMode ? tokenMasterCodeBoc.trim() : undefined,
            tokenWalletCodeBoc: isTokenMode ? tokenWalletCodeBoc.trim() : undefined,
            tokenAdminAddress: isTokenMode ? tokenAdminAddress.trim() : undefined,
            tokenContentCellBoc: isTokenMode && tokenContentCellBoc.trim() ? tokenContentCellBoc.trim() : undefined,
            tokenTotalSupply: isTokenMode && tokenTotalSupply.trim() ? tokenTotalSupply.trim() : undefined,
            network: requestedNetwork,
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        );

        const generationId = queueResponse.data?.generationId as string | undefined;
        if (!generationId) {
          throw new Error('Failed to enqueue generation');
        }

        setQueuedGenerationId(generationId);
        setIsBackground(true);
        startQueuePolling(generationId, authToken);
        return;
      }

      const payload = {
        prefix,
        matchType,
        targetAddress: isTokenMode ? undefined : targetAddress,
        targetKind,
        tokenMasterCodeBoc: isTokenMode ? tokenMasterCodeBoc.trim() : undefined,
        tokenWalletCodeBoc: isTokenMode ? tokenWalletCodeBoc.trim() : undefined,
        tokenAdminAddress: isTokenMode ? tokenAdminAddress.trim() : undefined,
        tokenContentCellBoc: isTokenMode && tokenContentCellBoc.trim() ? tokenContentCellBoc.trim() : undefined,
        tokenTotalSupply: isTokenMode && tokenTotalSupply.trim() ? tokenTotalSupply.trim() : undefined,
        network: requestedNetwork,
        socketId: socketRef.current?.id,
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/vanity-address`,
        payload,
        {
          signal: abortControllerRef.current.signal,
          timeout: 45000 // 45 second timeout mapping the backend 25s cutoff
        }
      );

      if (response.data.success) {
        if (response.data.status === 'processing') {
          // Backend is taking longer and switched to socket.io
          setGeneratedTargetKind(response.data.targetKind === 'token' ? 'token' : targetKind);
          setGeneratedNetwork(response.data.network === 'testnet' ? 'testnet' : requestedNetwork);
          setIsBackground(true);
        } else {
          // Found synchronously
          setGeneratedAddress(response.data.address);
          setGeneratedSalt(response.data.salt);
          setGeneratedTargetKind(
            response.data.targetKind === 'token' ? 'token' : response.data.targetKind === 'wallet' ? 'wallet' : targetKind,
          );
          setGeneratedNetwork(response.data.network === 'testnet' ? 'testnet' : requestedNetwork);
          setIsGenerating(false);
          setIsBackground(false);
          setError('');
        }
      } else {
        setError(response.data.error || 'Failed to generate address');
        setIsGenerating(false);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code !== 'ECONNABORTED') {
          setError(err.response?.data?.error || err.message || 'Network Error');
        }
      } else {
        setError('An unexpected error occurred');
      }
      setIsGenerating(false);
      setIsBackground(false);
    }
  };

  const handleDeployProxy = async () => {
    if (!userAddress) {
      setError('Please connect your TON wallet first');
      return;
    }

    if (!generatedAddress || !generatedSalt) {
      setError('Generate a vanity address first');
      return;
    }

    if (wallet && walletIsTestnet !== isGeneratedTestnet) {
      setError(`Connected wallet is on ${walletIsTestnet ? 'testnet' : 'mainnet'}, but the vanity address was generated for ${generatedNetwork}`);
      return;
    }

    try {
      const proxyCodeCell = Cell.fromBoc(Buffer.from(PROXY_CODE_BOC, 'base64'))[0];
      const targetAddr = Address.parse(targetAddress);

      const proxyDataCell = beginCell()
        .storeAddress(targetAddr)
        .storeUint(BigInt(generatedSalt), 64)
        .endCell();

      const stateInit: StateInit = {
        code: proxyCodeCell,
        data: proxyDataCell
      };

      const stateInitCell = beginCell()
        .store(storeStateInit(stateInit))
        .endCell();

      const derivedAddress = contractAddress(0, stateInit);
      const derivedRawAddress = derivedAddress.toRawString();
      const generatedRawAddress = Address.parse(generatedAddress).toRawString();

      if (derivedRawAddress !== generatedRawAddress) {
        throw new Error('Derived deployment address does not match the generated vanity address');
      }

      const stateInitBoc = stateInitCell.toBoc().toString('base64');
      const deploymentAddress = derivedAddress.toString({
        bounceable: true,
        testOnly: isGeneratedTestnet,
        urlSafe: true,
      });

      // Deploy takes ~0.05 TON for storage and gas
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 360,
        network: wallet?.account.chain,
        messages: [
          {
            address: deploymentAddress,
            amount: '50000000', // 0.05 TON
            stateInit: stateInitBoc,
          }
        ]
      };

      await tonConnectUI.sendTransaction(transaction);
      setDeployToast({
        address: deploymentAddress,
        network: generatedNetwork,
      });
    } catch (err) {
      console.error('Deployment error', err);
      setError(`Deployment failed: ${getErrorMessage(err, 'Unknown error')}`);
    }
  };

  const handleLoadTokenTemplate = async () => {
    if (!sourceTokenAddress.trim()) {
      setError('Please enter an existing token master address to load template from chain');
      return;
    }

    setIsLoadingTokenTemplate(true);
    setError('');

    try {
      const requestedNetwork = inferGenerationNetwork(sourceTokenAddress, wallet?.account.chain);
      const response = await axios.post(`${API_BASE_URL}/api/token-template`, {
        tokenAddress: sourceTokenAddress.trim(),
        network: requestedNetwork,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Unable to load token template from chain');
      }

      setTokenMasterCodeBoc(response.data.tokenMasterCodeBoc || '');
      setTokenWalletCodeBoc(response.data.tokenWalletCodeBoc || '');
      setTokenAdminAddress(response.data.tokenAdminAddress || '');
      setTokenContentCellBoc(response.data.tokenContentCellBoc || '');
      setTokenTotalSupply(response.data.tokenTotalSupply || '0');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message || 'Failed to load token template');
      } else {
        setError('Failed to load token template');
      }
    } finally {
      setIsLoadingTokenTemplate(false);
    }
  };

  const getTokenStateInitBoc = (): { stateInitBoc: string; deploymentAddress: string } => {
    const { stateInit, address } = buildTokenDeploymentStateInit({
      tokenMasterCodeBoc: tokenMasterCodeBoc.trim(),
      tokenWalletCodeBoc: tokenWalletCodeBoc.trim(),
      tokenAdminAddress: tokenAdminAddress.trim(),
      tokenContentCellBoc: tokenContentCellBoc.trim() || undefined,
      tokenTotalSupply: tokenTotalSupply.trim() || undefined,
      salt: generatedSalt,
    });

    const generatedRawAddress = Address.parse(generatedAddress).toRawString();
    const derivedRawAddress = address.toRawString();

    if (generatedRawAddress !== derivedRawAddress) {
      throw new Error('Derived token deployment address does not match generated vanity address. Keep all token inputs unchanged.');
    }

    const stateInitCell = beginCell().store(storeStateInit(stateInit)).endCell();
    const deploymentAddress = address.toString({
      bounceable: true,
      testOnly: isGeneratedTestnet,
      urlSafe: true,
    });

    return {
      stateInitBoc: stateInitCell.toBoc().toString('base64'),
      deploymentAddress,
    };
  };

  const handleCopyTokenStateInit = async () => {
    if (generatedTargetKind !== 'token') {
      return;
    }

    if (!generatedAddress || !generatedSalt) {
      setError('Generate a token vanity address first');
      return;
    }

    try {
      const { stateInitBoc, deploymentAddress } = getTokenStateInitBoc();
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            address: deploymentAddress,
            stateInitBoc,
            salt: generatedSalt,
            tokenAdminAddress: tokenAdminAddress.trim(),
            tokenTotalSupply: tokenTotalSupply.trim() || '0',
          },
          null,
          2,
        ),
      );
    } catch (err) {
      setError(`Failed to build token state init: ${getErrorMessage(err, 'Unknown error')}`);
    }
  };

  const handleDeployTokenMaster = async () => {
    if (!userAddress) {
      setError('Please connect your TON wallet first');
      return;
    }

    if (!generatedAddress || !generatedSalt) {
      setError('Generate a token vanity address first');
      return;
    }

    if (wallet && walletIsTestnet !== isGeneratedTestnet) {
      setError(`Connected wallet is on ${walletIsTestnet ? 'testnet' : 'mainnet'}, but the vanity address was generated for ${generatedNetwork}`);
      return;
    }

    try {
      const { stateInitBoc, deploymentAddress } = getTokenStateInitBoc();

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 360,
        network: wallet?.account.chain,
        messages: [
          {
            address: deploymentAddress,
            amount: '80000000',
            stateInit: stateInitBoc,
          }
        ]
      };

      await tonConnectUI.sendTransaction(transaction);
      setDeployToast({
        address: deploymentAddress,
        network: generatedNetwork,
      });
    } catch (err) {
      setError(`Token deployment failed: ${getErrorMessage(err, 'Unknown error')}`);
    }
  };

  const handleExportDeployPayload = async () => {
    if (!generatedAddress || !generatedSalt) {
      setError('Generate a token vanity address first');
      return;
    }

    setIsExportingPayload(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/token-deployment-payload`, {
        tokenMasterCodeBoc: tokenMasterCodeBoc.trim(),
        tokenWalletCodeBoc: tokenWalletCodeBoc.trim(),
        tokenAdminAddress: tokenAdminAddress.trim(),
        tokenContentCellBoc: tokenContentCellBoc.trim() || undefined,
        tokenTotalSupply: tokenTotalSupply.trim() || undefined,
        salt: generatedSalt,
        generatedAddress: Address.parse(generatedAddress).toRawString(),
      });

      const payload = response.data;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'payload.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message || 'Failed to export deployment payload');
      } else {
        setError(getErrorMessage(err, 'Failed to export deployment payload'));
      }
    } finally {
      setIsExportingPayload(false);
    }
  };

  const handleCopyDeployAddress = async () => {
    if (!deployToast) return;
    await navigator.clipboard.writeText(deployToast.address);
  };

  const handleOpenExplorer = () => {
    if (!deployToast) return;
    const base = deployToast.network === 'testnet' ? 'https://testnet.tonviewer.com/' : 'https://tonviewer.com/';
    window.open(`${base}${deployToast.address}`, '_blank', 'noopener,noreferrer');
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(displayGeneratedAddress || generatedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    stopQueuePolling();
    setIsGenerating(false);
    setIsBackground(false);
  };

  return (
    <div className="card">
      {deployToast && (
        <div className="deploy-toast" role="status" aria-live="polite">
          <div className="deploy-toast__main">
            <div>
              <p className="deploy-toast__title">Deployment submitted</p>
              <p className="deploy-toast__subtitle">
                Signed successfully on {deployToast.network}. Contract should appear shortly.
              </p>
            </div>

            <button
              type="button"
              className="deploy-toast__close"
              onClick={() => setDeployToast(null)}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>

          <div className="deploy-toast__address">{deployToast.address}</div>

          <div className="deploy-toast__actions">
            <button type="button" className="deploy-toast__btn" onClick={handleCopyDeployAddress}>
              <Copy size={14} /> Copy address
            </button>
            <button type="button" className="deploy-toast__btn" onClick={handleOpenExplorer}>
              <ExternalLink size={14} /> Open Tonviewer
            </button>
          </div>
        </div>
      )}

      <div className="card__header">
        <h2>{isTokenMode ? '🪙 Generate Token Address' : '⚡ Generate Proxy Address'}</h2>
        <p className="label">
          {isTokenMode
            ? 'Generate a vanity Jetton master address from your token contract code.'
            : 'Generate a vanity address that forwards to your contract'}
        </p>
        <p className="label" style={{ marginTop: '8px', fontSize: '12px' }}>
          {authState === 'ready'
            ? 'Queue mode enabled: jobs are persisted and can be resumed later.'
            : 'Direct mode enabled: open from Telegram WebApp to enable persisted queue mode.'}
        </p>
        {queuedGenerationId && (
          <p className="label" style={{ marginTop: '4px', fontSize: '12px' }}>
            Active generation ID: {queuedGenerationId}
          </p>
        )}
      </div>

      <form onSubmit={handleGenerate} className="card__form">
        <div>
          <label className="label">Mode</label>
          <div className="button-group">
            <button
              type="button"
              className={`button-group-item ${targetKind === 'contract' ? 'active' : ''}`}
              onClick={() => setTargetKind('contract')}
              disabled={isGenerating}
            >
              Contract / Proxy
            </button>
            <button
              type="button"
              className={`button-group-item ${targetKind === 'token' ? 'active' : ''}`}
              onClick={() => setTargetKind('token')}
              disabled={isGenerating}
            >
              Token (Jetton)
            </button>
          </div>
        </div>

        <div>
          {!isTokenMode ? (
            <>
              <label className="label">Initial Contract Address (Target)</label>
              <input
                type="text"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder="e.g., EQ..."
                className="input"
                disabled={isGenerating}
                required
              />
            </>
          ) : (
            <>
              <label className="label">Load Existing Token Template (optional)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={sourceTokenAddress}
                  onChange={(e) => setSourceTokenAddress(e.target.value)}
                  placeholder="Existing Jetton master address"
                  className="input"
                  disabled={isGenerating || isLoadingTokenTemplate}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleLoadTokenTemplate}
                  disabled={isGenerating || isLoadingTokenTemplate || !sourceTokenAddress.trim()}
                >
                  {isLoadingTokenTemplate ? 'Loading...' : 'Load From Chain'}
                </button>
              </div>

              <label className="label">Token Admin Address</label>
              <input
                type="text"
                value={tokenAdminAddress}
                onChange={(e) => setTokenAdminAddress(e.target.value)}
                placeholder="e.g., EQ..."
                className="input"
                disabled={isGenerating || isLoadingTokenTemplate}
                required
              />

              <label className="label" style={{ marginTop: '12px', display: 'block' }}>Jetton Master Code BOC (base64)</label>
              <textarea
                value={tokenMasterCodeBoc}
                onChange={(e) => setTokenMasterCodeBoc(e.target.value)}
                placeholder="Paste compiled Jetton master code BOC"
                className="input"
                disabled={isGenerating || isLoadingTokenTemplate}
                rows={3}
                required
              />

              <label className="label" style={{ marginTop: '12px', display: 'block' }}>Jetton Wallet Code BOC (base64)</label>
              <textarea
                value={tokenWalletCodeBoc}
                onChange={(e) => setTokenWalletCodeBoc(e.target.value)}
                placeholder="Paste compiled Jetton wallet code BOC"
                className="input"
                disabled={isGenerating || isLoadingTokenTemplate}
                rows={3}
                required
              />

              <label className="label" style={{ marginTop: '12px', display: 'block' }}>Token Content Cell BOC (optional)</label>
              <textarea
                value={tokenContentCellBoc}
                onChange={(e) => setTokenContentCellBoc(e.target.value)}
                placeholder="Optional metadata/content root cell BOC"
                className="input"
                disabled={isGenerating || isLoadingTokenTemplate}
                rows={2}
              />

              <label className="label" style={{ marginTop: '12px', display: 'block' }}>Token Total Supply (optional bigint)</label>
              <input
                type="text"
                value={tokenTotalSupply}
                onChange={(e) => setTokenTotalSupply(e.target.value)}
                placeholder="e.g., 1000000000000"
                className="input"
                disabled={isGenerating || isLoadingTokenTemplate}
              />
            </>
          )}
        </div>

        <div>
          <label className="label">Placement</label>
          <div className="button-group">
            <button
              type="button"
              className={`button-group-item ${matchType === 'prefix' ? 'active' : ''}`}
              onClick={() => setMatchType('prefix')}
              disabled={isGenerating}
            >
              Prefix
            </button>
            <button
              type="button"
              className={`button-group-item ${matchType === 'suffix' ? 'active' : ''}`}
              onClick={() => setMatchType('suffix')}
              disabled={isGenerating}
            >
              Suffix
            </button>
            <button
              type="button"
              className={`button-group-item ${matchType === 'contains' ? 'active' : ''}`}
              onClick={() => setMatchType('contains')}
              disabled={isGenerating}
            >
              Contains
            </button>
          </div>
          <div className="difficulty-hint" role="status" aria-live="polite">
            <span className={`difficulty-badge difficulty-${difficulty.level.toLowerCase()}`}>{difficulty.level}</span>
            <span>{difficulty.note}</span>
          </div>
        </div>

        <div>
          <label className="label">Vanity Text</label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="e.g., TON, FOO"
            className="input"
            disabled={isGenerating}
            maxLength={10}
            required
          />
          <p className="label" style={{ marginTop: '8px', fontSize: '12px' }}>
            {prefix.length}/10 characters
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="submit"
            className="button button-primary"
            disabled={
              isGenerating ||
              !prefix.trim() ||
              (!isTokenMode && !targetAddress.trim()) ||
              (isTokenMode && (!tokenMasterCodeBoc.trim() || !tokenWalletCodeBoc.trim() || !tokenAdminAddress.trim()))
            }
            style={{ flex: 1 }}
          >
            {isGenerating ? (
              <>
                <span className="spinning">⚙️</span> {isBackground ? 'Background Searching...' : 'Generating...'}
              </>
            ) : (
              <>
                <Zap size={18} /> {isTokenMode ? 'Generate Token Vanity' : 'Generate Proxy'}
              </>
            )}
          </button>

          {isGenerating && (
            <button type="button" className="button button-secondary" onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {generatedAddress && (
        <div className="result-card">
          <div className="result-header">
            <h3>{generatedTargetKind === 'token' ? '✨ Token Vanity Address Ready!' : '✨ Proxy Address Ready!'}</h3>
          </div>

          <div className="result-field">
            <label>Vanity Address</label>
            <div className="copy-field">
              <code className="small">{displayGeneratedAddress}</code>
              <button type="button" className="icon-button" onClick={copyToClipboard} title="Copy address">
                {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>

            <p className="label" style={{ marginTop: '8px', fontSize: '12px' }}>
              Generated for {generatedNetwork}. The raw contract address stays the same across networks, but the user-friendly string changes.
            </p>

            {generatedTargetKind !== 'token' ? (
              <>
                <p className="label" style={{ marginTop: '12px', marginBottom: '12px' }}>
                  To use this address, you must deploy the proxy smart-contract first so it can forward messages:
                </p>

                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleDeployProxy}
                  title={!userAddress ? 'Please connect wallet first' : 'Deploy proxy contract'}
                  style={{ width: '100%' }}
                >
                  <Rocket size={18} /> Deploy Forward Proxy (~0.05 TON)
                </button>
              </>
            ) : (
              <>
                <p className="label" style={{ marginTop: '12px', marginBottom: '12px' }}>
                  Deploy your Jetton master with the same code/data settings and salt {generatedSalt} to activate this token address.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="button button-secondary" onClick={handleCopyTokenStateInit}>
                    <Copy size={16} /> Copy Token StateInit
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={handleExportDeployPayload}
                    disabled={isExportingPayload}
                    title="Download ready-to-deploy payload.json for CI/scripting"
                  >
                    <Download size={16} /> {isExportingPayload ? 'Exporting…' : 'Export Deploy Payload'}
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleDeployTokenMaster}
                    title={!userAddress ? 'Please connect wallet first' : 'Deploy token master contract'}
                  >
                    <Rocket size={18} /> Deploy Token Master (~0.08 TON)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VanityGenerator;