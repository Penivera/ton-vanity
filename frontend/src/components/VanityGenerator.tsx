import { useState } from 'react';
import axios from 'axios';

const VanityGenerator = () => {
  const [prefix, setPrefix] = useState('');
  const [result, setResult] = useState({
    generatedAddress: '',
    error: ''
  });

  const handleGenerate = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/vanity-address', { prefix });
      setResult({ generatedAddress: response.data.generatedAddress, error: '' });
    } catch (err) {
      setResult({ generatedAddress: '', error: err.response?.data?.error || 'An error occurred' });
    }
  };

  return (
    <form onSubmit={handleGenerate} className="vanity-generator" style={{ textAlign: 'center', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Generate Your Vanity Address</h2>
      <input
        type="text"
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
        placeholder="Enter prefix"
        style={{ padding: '10px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd', width: 'calc(100% - 10px)', maxWidth: '400px', marginBottom: '1rem' }}
      />
      <br />
      <button
        type="submit"
        style={{ padding: '10px 20px', backgroundColor: '#4C6EF5', color: '#fff', borderRadius: '4px', border: 'none', fontSize: '1rem', cursor: 'pointer' }}
      >
        Generate
      </button>

      {result.generatedAddress && (
        <p style={{ marginTop: '1rem', padding: '10px', backgroundColor: '#DFF2BF', color: '#4F8A10', borderRadius: '4px' }}>
          Generated Address: <strong>{result.generatedAddress}</strong>
        </p>
      )}
      {result.error && (
        <p style={{ marginTop: '1rem', padding: '10px', backgroundColor: '#FFD2D2', color: '#D8000C', borderRadius: '4px' }}>
          Error: {result.error}
        </p>
      )}
    </form>
  );
};

export default VanityGenerator;