import VanityGenerator from './components/VanityGenerator';
import TonConnectIntegration from './components/TonConnectIntegration';

const App = () => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.6', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5em', color: '#333' }}>Vanity Address Generator</h1>
        <p style={{ fontSize: '1.2em', color: '#666' }}>
          Easily create personalized blockchain addresses.
        </p>
      </header>
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <section style={{ marginBottom: '40px', width: '100%', maxWidth: '600px' }}>
          <VanityGenerator />
        </section>
        <section style={{ width: '100%', maxWidth: '600px' }}>
          <TonConnectIntegration />
        </section>
      </main>
      <footer style={{ textAlign: 'center', marginTop: '40px', color: '#888' }}>
        <small>&copy; 2026 Vanity. All rights reserved.</small>
      </footer>
    </div>
  );
};

export default App;