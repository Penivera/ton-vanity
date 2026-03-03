import VanityGenerator from './components/VanityGenerator';
import TonConnectIntegration from './components/TonConnectIntegration';

const App = () => {
  return (
    <div className="app-container" style={{ fontFamily: 'Roboto, sans-serif' }}>
      <header className="app-header" style={{ textAlign: 'center', padding: '20px', backgroundColor: '#4C6EF5', color: 'white', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0' }}>Vanity Address Generator</h1>
        <p>Easily create personalized blockchain addresses</p>
      </header>

      <main className="app-main" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <section className="generator-section" style={{ marginBottom: '40px' }}>
          <VanityGenerator />
        </section>
        <section className="wallet-section" style={{ marginTop: '40px' }}>
          <TonConnectIntegration />
        </section>
      </main>

      <footer className="app-footer" style={{ textAlign: 'center', marginTop: '40px', padding: '10px', borderTop: '1px solid #ccc', color: '#666' }}>
        <small>&copy; 2026 Vanity Generator. All rights reserved.</small>
      </footer>
    </div>
  );
};

export default App;