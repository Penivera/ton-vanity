import VanityGenerator from './components/VanityGenerator';
import TonConnectIntegration from './components/TonConnectIntegration';
import './App.css';

const App = () => {
  return (
    <div className="app">
      <header className="header">
        <div className="header__content">
          <h1>Vanity Address Generator</h1>
          <p>Generate personalized wallet addresses</p>
        </div>
        <div className="header__wallet">
          <TonConnectIntegration />
        </div>
      </header>

      <main className="main">
        <VanityGenerator />
      </main>
    </div>
  );
};

export default App;