import { useEffect, useState } from "react";

let walletKit: any = null;

async function initializeWalletKit() {
  try {
    const { TonWalletKit, Network, MemoryStorageAdapter } = await import("@ton/walletkit");
    const bridgeUrl = "https://connect.ton.org/bridge";
    const mainnet = Network.mainnet();

    walletKit = new TonWalletKit({
      bridge: { bridgeUrl },
      networks: {
        [mainnet.chainId]: { apiClient: { url: "https://toncenter.com" } },
      },
      storage: new MemoryStorageAdapter({}),
    });
  } catch (error) {
    console.error("Failed to initialize wallet kit:", error);
  }
}

initializeWalletKit();

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeWallet() {
      try {
        if (!walletKit) return;
        await walletKit.waitForReady();
        const wallets = await walletKit.getWallets();
        if (wallets.length > 0) {
          setAddress(wallets[0].getAddress());
        }
      } catch (error: any) {
        console.error("TON Connect initialization failed:", error);
        setError("Wallet connection unavailable");
      }
    }
    initializeWallet();
  }, []);

  const handleConnect = async () => {
    try {
      if (!walletKit) {
        setError("Wallet not initialized");
        return;
      }
      const wallet = await walletKit.addWallet();
      setAddress(wallet.getAddress());
    } catch (error: any) {
      console.error("Connection failed:", error);
      setError("Failed to connect wallet");
    }
  };

  if (error) {
    return <div style={{ color: '#ffa500', fontSize: '12px' }}>{error}</div>;
  }

  return (
    <div>
      {address ? (
        <p style={{ color: '#00d084', fontSize: '12px' }}>Connected Wallet: {address.slice(0, 10)}...</p>
      ) : (
        <button onClick={handleConnect} style={{ fontSize: '12px', padding: '8px 12px' }}>Connect Wallet</button>
      )}
    </div>
  );
}