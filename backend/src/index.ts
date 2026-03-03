import express from 'express';
import { generateVanityAddress } from './workers/vanityWorker';

const app = express();
app.use(express.json());

// Endpoint for generating vanity addresses
app.post('/api/vanity-address', generateVanityAddress);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});