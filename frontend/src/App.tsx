import VanityGenerator from './components/VanityGenerator';

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