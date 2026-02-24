import {
  TonWalletKit,
  Network,
  MemoryStorageAdapter,
} from "@ton/walletkit";
import { useEffect, useState } from "react";

const bridgeUrl = "https://connect.ton.org/bridge";
const mainnet = Network.mainnet();

const walletKit = new TonWalletKit({
  bridge: { bridgeUrl },
  networks: {
    [mainnet.chainId]: { apiClient: { url: "https://toncenter.com" } },
  },
  storage: new MemoryStorageAdapter({}),
});

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    async function initializeWallet() {
      try {
        await walletKit.waitForReady();
        const wallets = await walletKit.getWallets();
        if (wallets.length > 0) {
          setAddress(wallets[0].getAddress());
        }
      } catch (error) {
        console.error("TON Connect initialization failed:", error);
      }
    }
    initializeWallet();
  }, []);

  const handleConnect = async () => {
    try {
      const wallet = await walletKit.addWallet();
      setAddress(wallet.getAddress());
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  return (
    <div>
      {address ? (
        <p>Connected Wallet: {address}</p>
      ) : (
        <button onClick={handleConnect}>Connect Wallet</button>
      )}
    </div>
  );
}