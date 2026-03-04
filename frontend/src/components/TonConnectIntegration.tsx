import { useEffect, useState } from 'react';
import { TonConnectUI, TonConnectUIError } from '@tonconnect/ui-react';
import { Copy, Check } from 'lucide-react';

const TonConnectIntegration = () => {
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const initializeTonConnect = async () => {
      try {
        const ui = new TonConnectUI({
          manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
        });
        setTonConnectUI(ui);

        // Check if wallet is already connected
        if (ui.account) {
          setWalletAddress(ui.account.address);
          setWalletName(ui.account.name || 'Connected Wallet');
          setIsConnected(true);
        }

        // Subscribe to account changes
        ui.onAccountChange((account) => {
          if (account) {
            setWalletAddress(account.address);
            setWalletName(account.name || 'Connected Wallet');
            setIsConnected(true);
          } else {
            setWalletAddress('');
            setWalletName('');
            setIsConnected(false);
          }
        });

        // Subscribe to status changes
        ui.onStatusChange((account) => {
          if (!account) {
            setIsConnected(false);
          }
        });
      } catch (error) {
        if (error instanceof TonConnectUIError) {
          console.error('TonConnectUI error:', error);
        }
      }
    };

    initializeTonConnect();
  }, []);

  const handleConnect = async () => {
    if (!tonConnectUI) return;

    try {
      await tonConnectUI.openSingleModal();
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  const handleDisconnect = async () => {
    if (!tonConnectUI) return;
    await tonConnectUI.disconnect();
    setWalletAddress('');
    setWalletName('');
    setIsConnected(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="card__header">
        <h2>TON Wallet Connection</h2>
        <p className="label">Connect your TON wallet to generate addresses</p>
      </div>

      {!isConnected ? (
        <button className="button button-primary" onClick={handleConnect}>
          🔗 Connect Wallet
        </button>
      ) : (
        <div className="card__content">
          <div className="result-field">
            <label>Connected Wallet</label>
            <div className="copy-field">
              <code className="small">{walletAddress}</code>
              <button
                className="icon-button"
                onClick={copyToClipboard}
                title="Copy address"
              >
                {copied ? (
                  <Check size={16} style={{ color: 'var(--success)' }} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
          <button
            className="button button-secondary"
            onClick={handleDisconnect}
          >
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
};

export default TonConnectIntegration;