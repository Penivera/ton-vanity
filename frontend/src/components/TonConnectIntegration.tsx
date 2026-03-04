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
    <div className="wallet-connect">
      {!isConnected ? (
        <button className="wallet-button" onClick={handleConnect}>
          <span className="wallet-icon">👛</span>
          <span className="wallet-text">Connect Wallet</span>
        </button>
      ) : (
        <div className="wallet-connected">
          <div className="wallet-address" title={walletAddress}>
            <span className="wallet-icon-small">✓</span>
            <code className="address-short">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </code>
            <button
              className="wallet-copy-btn"
              onClick={copyToClipboard}
              title="Copy address"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <button
            className="wallet-disconnect"
            onClick={handleDisconnect}
            title="Disconnect wallet"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default TonConnectIntegration;