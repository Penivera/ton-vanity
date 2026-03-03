import { useState } from 'react';
import axios from 'axios';

const VanityGenerator = () => {
  const [prefix, setPrefix] = useState('');
  const [generatedAddress, setGeneratedAddress] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2>Generate Your Vanity Address</h2>
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Enter prefix"
          style={{ margin: '10px 0', padding: '8px', fontSize: '1em', border: '1px solid #ccc', borderRadius: '4px', width: '100%', maxWidth: '400px' }}
        />
        <button
          type="submit"
          style={{ backgroundColor: '#007BFF', color: '#FFF', padding: '10px 20px', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '1em' }}
        >
          Generate
        </button>
      </form>
      {generatedAddress && (
        <p style={{ marginTop: '20px', color: 'green', fontSize: '1.2em' }}>Generated Address: {generatedAddress}</p>
      )}
      {error && (
        <p style={{ marginTop: '20px', color: 'red', fontSize: '1.2em' }}>{error}</p>
      )}
    </div>
  );
};

export default VanityGenerator;