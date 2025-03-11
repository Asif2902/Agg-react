import React from 'react';
import { Header } from './components/Header';
import { Swap } from './components/Swap';
import { Notifications } from './components/Notifications';
import { WalletProvider } from './wallet/WalletContext';
import './styles.css';

function App() {
  return (
    <WalletProvider>
      <div>
        <Header />
        <div className="container">
          <Swap />
        </div>
        <Notifications />
      </div>
    </WalletProvider>
  );
}

export default App;
