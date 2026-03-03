// Updated realistic types for TON Connect
interface Connection {
  status: 'connected' | 'disconnected';
  wallet: string | null;
}
const tonConnection: Connection = {
  status: 'disconnected',
  wallet: null,
};

export default tonConnection;