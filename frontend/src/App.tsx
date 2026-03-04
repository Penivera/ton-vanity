import VanityGenerator from './components/VanityGenerator';
import TonConnectIntegration from './components/TonConnectIntegration';

const App = () => {
  return (
    <div className="app">
      <header className="header">
        <div className="header__content">
          <h1>TON Vanity Address Generator</h1>
          <p>Generate personalized TON wallet addresses</p>
        </div>
      </header>

      <main className="main">
        <TonConnectIntegration />
        <VanityGenerator />
      </main>
    </div>
  );
};

export default App;