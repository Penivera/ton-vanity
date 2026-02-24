import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, RefreshCw, Wallet, Shield, AlertTriangle, CheckCircle2, Pause, Play } from 'lucide-react';
import './App.css';
import { WalletConnect } from './tonConnect';

interface VanityResult {
  address: string;
  publicKey: string;
  secretKey: string;
  walletType: 'v4r2' | 'simple';
  pattern: string;
  attempts: number;
  timeTaken: number;
}

interface Progress {
  attempts: number;
  attemptsPerSecond: number;
  estimatedTimeSeconds: number | null;
  status: 'running' | 'found' | 'stopped' | 'error';
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [pattern, setPattern] = useState('');
  const [patternType, setPatternType] = useState<'prefix' | 'suffix' | 'contains'>('suffix');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [walletType, setWalletType] = useState<'v4r2' | 'simple'>('v4r2');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<VanityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  useEffect(() => {
    // Initialize Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    // Connect to socket
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('progress', (data: Progress) => {
      setProgress(data);
    });

    newSocket.on('found', (data: VanityResult) => {
      setResult(data);
      setIsGenerating(false);
      setProgress(null);
    });

    newSocket.on('stopped', () => {
      setIsGenerating(false);
      setProgress(null);
    });

    newSocket.on('error', (data: { message: string }) => {
      setError(data.message);
      setIsGenerating(false);
      setProgress(null);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleStart = () => {
    if (!pattern || pattern.length < 3 || pattern.length > 6) {
      setError('Pattern must be 3-6 characters');
      return;
    }

    // Validate pattern (hex characters only for addresses)
    if (!/^[a-fA-F0-9]+$/.test(pattern)) {
      setError('Pattern must contain only hex characters (0-9, A-F)');
      return;
    }

    setError(null);
    setResult(null);
    setIsGenerating(true);
    setProgress({
      attempts: 0,
      attemptsPerSecond: 0,
      estimatedTimeSeconds: null,
      status: 'running'
    });

    socket?.emit('start-generation', {
      pattern,
      type: patternType,
      caseSensitive,
      walletType
    });
  };

  const handleStop = () => {
    socket?.emit('stop-generation');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="app">
      <header className="header">
        <WalletConnect />
        <Wallet size={32} className="icon" />
        <h1>TON Vanity Generator</h1>
        <p>Create custom TON wallet addresses</p>
      </header>

      <main className="main">
        {!result ? (
          <>
            <div className="card">
              <label className="label">Pattern (3-6 characters)</label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value.toUpperCase())}
                placeholder="e.g., BONK"
                maxLength={6}
                disabled={isGenerating}
                className="input"
              />

              <label className="label">Pattern Type</label>
              <div className="button-group">
                {(['prefix', 'suffix', 'contains'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setPatternType(type)}
                    disabled={isGenerating}
                    className={`button-group-item ${patternType === type ? 'active' : ''}`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              <label className="label">Wallet Type</label>
              <div className="button-group">
                <button
                  onClick={() => setWalletType('v4r2')}
                  disabled={isGenerating}
                  className={`button-group-item ${walletType === 'v4r2' ? 'active' : ''}`}
                >
                  Wallet V4R2
                </button>
                <button
                  onClick={() => setWalletType('simple')}
                  disabled={isGenerating}
                  className={`button-group-item ${walletType === 'simple' ? 'active' : ''}`}
                >
                  Simple Wallet
                </button>
              </div>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  disabled={isGenerating}
                />
                Case sensitive
              </label>

              {error && (
                <div className="error">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              {!isGenerating ? (
                <button onClick={handleStart} className="button button-primary">
                  <Play size={18} />
                  Start Generation
                </button>
              ) : (
                <button onClick={handleStop} className="button button-secondary">
                  <Pause size={18} />
                  Stop
                </button>
              )}
            </div>

            {progress && (
              <div className="card progress-card">
                <div className="progress-header">
                  <RefreshCw size={20} className="spinning" />
                  <span>Generating...{progress.attemptsPerSecond > 0 && (
                    ` ${progress.attemptsPerSecond.toLocaleString()} addr/s`
                  )}</span>
                </div>
                
                <div className="progress-stats">
                  <div>
                    <span className="stat-label">Attempts:</span>
                    <span className="stat-value">{progress.attempts.toLocaleString()}</span>
                  </div>
                  {progress.estimatedTimeSeconds !== null && (
                    <div>
                      <span className="stat-label">Est. time:</span>
                      <span className="stat-value">{formatTime(progress.estimatedTimeSeconds)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card result-card">
            <div className="result-header">
              <CheckCircle2 size={24} className="success-icon" />
              <h2>Address Found!</h2>
            </div>

            <div className="qr-container">
              <QRCodeSVG value={result.address} size={180} />
            </div>

            <div className="result-field">
              <label>Address</label>
              <div className="copy-field">
                <code>{result.address}</code>
                <button 
                  onClick={() => copyToClipboard(result.address, 'address')}
                  className="icon-button"
                >
                  {copied === 'address' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="result-field">
              <label>Public Key</label>
              <div className="copy-field">
                <code className="small">{result.publicKey.slice(0, 32)}...{result.publicKey.slice(-32)}</code>
                <button 
                  onClick={() => copyToClipboard(result.publicKey, 'publicKey')}
                  className="icon-button"
                >
                  {copied === 'publicKey' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="result-field private-key-field">
              <label>
                <Shield size={14} /
                >
                Private Key (Secret!)
              </label>
              <button 
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="toggle-button"
              >
                {showPrivateKey ? 'Hide' : 'Show'}
              </button>
              
              {showPrivateKey && (
                <>
                  <div className="copy-field">
                    <code className="small secret">{result.secretKey}</code>
                    <button 
                      onClick={() => copyToClipboard(result.secretKey, 'secretKey')}
                      className="icon-button"
                    >
                      {copied === 'secretKey' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <div className="warning">
                    <AlertTriangle size={14} /
                    >
                    Save this private key immediately! We don't store it.
                  </div>
                </>
              )}
            </div>

            <div className="result-stats">
              <span>Attempts: {result.attempts.toLocaleString()}</span>
              <span>Time: {result.timeTaken.toFixed(2)}s</span>
            </div>

            <button 
              onClick={() => {
                setResult(null);
                setShowPrivateKey(false);
              }}
              className="button button-primary"
            >
              Generate Another
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;