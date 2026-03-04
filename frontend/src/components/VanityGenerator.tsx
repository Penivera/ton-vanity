import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Zap, Copy, Check, AlertCircle } from 'lucide-react';

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
      const response = await axios.post(
        '/api/vanity-address',
        { prefix },
        { signal: abortControllerRef.current.signal }
      );

      if (response.data.success) {
        setGeneratedAddress(response.data.address);
        setError('');
      } else {
        setError(response.data.error || 'Failed to generate address');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code !== 'ECONNABORTED') {
          setError(
            err.response?.data?.error ||
            err.message ||
            'Failed to generate address'
          );
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
        <h2>Generate Vanity Address</h2>
        <p className="label">Find a TON address that matches your desired prefix</p>
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