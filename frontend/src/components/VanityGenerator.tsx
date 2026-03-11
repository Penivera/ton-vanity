import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Zap, Copy, Check, AlertCircle, Rocket } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { CHAIN } from '@tonconnect/sdk';
import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { Address, beginCell, Cell, contractAddress, storeStateInit } from '@ton/core';
import type { StateInit } from '@ton/core';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const PROXY_CODE_BOC = 'te6cckEBAgEAQAABFP8A9KQT9LzyyAsBAGLTMwGCCJiWgLmRW+DQ0wMwcbCRMODtRND6QDBwgBDIywVYzxYh+gLLagHPFsmAQPsA9B+UgA==';

type MatchType = 'prefix' | 'suffix' | 'contains';

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

const VanityGenerator = () => {
  const [prefix, setPrefix] = useState('');
  const [targetAddress, setTargetAddress] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('prefix');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBackground, setIsBackground] = useState(false);

  const [generatedAddress, setGeneratedAddress] = useState('');
  const [generatedSalt, setGeneratedSalt] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const difficulty = getDifficulty(prefix, matchType);

  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const wallet = useTonWallet();
  const isTestnet = wallet?.account.chain === CHAIN.TESTNET;
  const displayGeneratedAddress = generatedAddress ? formatAddressForNetwork(generatedAddress, isTestnet) : '';

  useEffect(() => {
    // Initialize socket
    socketRef.current = io(API_BASE_URL || window.location.origin);

    socketRef.current.on('vanityFound', (data: any) => {
      if (data.success) {
        setGeneratedAddress(data.address);
        setGeneratedSalt(data.salt);
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
    };
  }, []);

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setGeneratedAddress('');
    setGeneratedSalt('');

    if (!prefix.trim() || !targetAddress.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (prefix.length > 10) {
      setError('Prefix must be 10 characters or less');
      return;
    }

    setIsGenerating(true);
    setIsBackground(false);
    abortControllerRef.current = new AbortController();

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/vanity-address`,
        {
          prefix,
          matchType,
          targetAddress,
          socketId: socketRef.current?.id
        },
        {
          signal: abortControllerRef.current.signal,
          timeout: 45000 // 45 second timeout mapping the backend 25s cutoff
        }
      );

      if (response.data.success) {
        if (response.data.status === 'processing') {
          // Backend is taking longer and switched to socket.io
          setIsBackground(true);
        } else {
          // Found synchronously
          setGeneratedAddress(response.data.address);
          setGeneratedSalt(response.data.salt);
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
        testOnly: isTestnet,
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
      alert('Transaction sent! The proxy contract will be deployed shortly.');
    } catch (err: any) {
      console.error('Deployment error', err);
      setError(`Deployment failed: ${err.message || 'Unknown error'}`);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(displayGeneratedAddress || generatedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsGenerating(false);
    setIsBackground(false);
  };

  return (
    <div className="card">
      <div className="card__header">
        <h2>⚡ Generate Proxy Address</h2>
        <p className="label">Generate a vanity address that forwards to your contract</p>
      </div>

      <form onSubmit={handleGenerate} className="card__form">
        <div>
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
            disabled={isGenerating || !prefix.trim() || !targetAddress.trim()}
            style={{ flex: 1 }}
          >
            {isGenerating ? (
              <>
                <span className="spinning">⚙️</span> {isBackground ? 'Background Searching...' : 'Generating...'}
              </>
            ) : (
              <>
                <Zap size={18} /> Generate Proxy
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
            <h3>✨ Proxy Address Ready!</h3>
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
              Displaying the {isTestnet ? 'testnet' : 'mainnet'} user-friendly format. The raw contract address stays the same across networks.
            </p>

            <p className="label" style={{ marginTop: '12px', marginBottom: '12px' }}>
              To use this address, you must deploy the proxy smart-contract first so it can forward messages:
            </p>

            <button
              type="button"
              className="button button-primary"
              onClick={handleDeployProxy}
              title={!userAddress ? "Please connect wallet first" : "Deploy proxy contract"}
              style={{ width: '100%' }}
            >
              <Rocket size={18} /> Deploy Forward Proxy (~0.05 TON)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VanityGenerator;