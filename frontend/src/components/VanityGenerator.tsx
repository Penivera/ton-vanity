import { useState } from 'react';
import axios from 'axios';

const VanityGenerator = () => {
  const [prefix, setPrefix] = useState('');
  const [generatedAddress, setGeneratedAddress] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    try {
      const response = await axios.post('/api/vanity-address', { prefix });
      setGeneratedAddress(response.data.generatedAddress);
      setError('');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'An error occurred');
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  return (
    <div>
      <h2>Vanity Address Generator</h2>
      <input
        type="text"
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
        placeholder="Enter prefix"
      />
      <button onClick={handleGenerate}>Generate</button>
      {generatedAddress && <p>Generated Address: {generatedAddress}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default VanityGenerator;