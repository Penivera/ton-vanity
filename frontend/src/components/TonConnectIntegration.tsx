import { useState } from 'react';
import { useTonConnectUI, useTonWallet, useTonAddress } from '@tonconnect/ui-react';
import { Copy, Check } from 'lucide-react';

const TonConnectIntegration = () => {
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const wallet = useTonWallet();
  const [copied, setCopied] = useState(false);

  const isConnected = !!wallet;

  const handleConnect = async () => {
    try {
      await tonConnectUI.openModal();
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  const handleDisconnect = async () => {
    await tonConnectUI.disconnect();
  };

  const copyToClipboard = async () => {
    if (!walletAddress) return;
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