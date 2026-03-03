import VanityGenerator from './components/VanityGenerator';
import TonConnectIntegration from './components/TonConnectIntegration';

const App = () => {
  return (
    <div>
      <h1>Vanity Address Generator</h1>
      <VanityGenerator />
      <TonConnectIntegration />
    </div>
  );
};

export default App;