import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Zap, Copy, Check, AlertCircle } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const VanityGenerator = () => {
  const [prefix, setPrefix] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAddress, setGeneratedAddress] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setGeneratedAddress('');

    if (!prefix.trim()) {
      setError('Please enter a prefix');
      return;
    }

    if (prefix.length > 10) {
      setError('Prefix must be 10 characters or less');
      return;
    }

    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      console.log('Making request to /api/vanity-address with prefix:', prefix);
      const response = await axios.post(
        `${API_BASE_URL}/api/vanity-address`,
        { prefix },
        { 
          signal: abortControllerRef.current.signal,
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('Response received:', response.data);

      if (response.data.success) {
        setGeneratedAddress(response.data.address);
        setError('');
      } else {
        setError(response.data.error || 'Failed to generate address');
      }
    } catch (err) {
      console.error('Error during generation:', err);
      if (axios.isAxiosError(err)) {
        if (err.code !== 'ECONNABORTED') {
          const errorMessage = err.response?.data?.error || 
                              err.message || 
                              `Request failed: ${err.response?.status || 'Network Error'}`;
          setError(errorMessage);
          console.error('Axios error details:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            message: err.message
          });
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
  };

  return (
    <div className="card">
      <div className="card__header">
        <h2>⚡ Generate Address</h2>
        <p className="label">Find an address matching your desired prefix</p>
      </div>

      <form onSubmit={handleGenerate} className="card__form">
        <div>
          <label className="label">Address Prefix</label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="e.g., TON, LUCKY, DOGE"
            className="input"
            disabled={isGenerating}
            maxLength={10}
          />
          <p className="label" style={{ marginTop: '8px', fontSize: '12px' }}>
            {prefix.length}/10 characters
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="submit"
            className="button button-primary"
            disabled={isGenerating || !prefix.trim()}
            style={{ flex: 1 }}
          >
            {isGenerating ? (
              <>
                <span className="spinning">⚙️</span> Generating...
              </>
            ) : (
              <>
                <Zap size={18} /> Generate
              </>
            )}
          </button>

          {isGenerating && (
            <button
              type="button"
              className="button button-secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {generatedAddress && (
        <div className="result-card">
          <div className="result-header">
            <h3>✨ Address Generated!</h3>
          </div>

          <div className="result-field">
            <label>Your Vanity Address</label>
            <div className="copy-field">
              <code className="small">{generatedAddress}</code>
              <button
                type="button"
                className="icon-button"
                onClick={copyToClipboard}
                title="Copy address"
              >
                {copied ? (
                  <Check size={16} style={{ color: 'var(--success)' }} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VanityGenerator;