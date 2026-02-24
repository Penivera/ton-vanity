import { v4 as uuidv4 } from 'uuid';

const TON_CONNECT_URL = 'https://tonconnect.io';  // Replace with the actual URL

/**
 * Generate TON Connect Deep Link.
 * @param {string} appName Name of the app requesting connection.
 * @param {string} walletAddress TON Wallet Address.
 * @returns {string} TON Connect Deep Link.
 */
export function generateTonConnectLink(appName: string, walletAddress: string): string {
  const sessionId = uuidv4();

  // Envelope the connection request
  const connectionPayload = {
    id: sessionId,
    name: appName,
    wallet: walletAddress,
  };

  const encodedPayload = encodeURIComponent(JSON.stringify(connectionPayload));
  return `${TON_CONNECT_URL}?connect=${encodedPayload}`;
}