import React from 'react';
import { useWalletContext } from './WalletContext';
import { formatAddress } from '../utils';

export function WalletButton() {
  const { userAddress, connectWallet } = useWalletContext();

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (e) {
      console.error("Wallet connection failed", e);
    }
  };

  return (
    <button onClick={handleConnect}>
      {userAddress ? formatAddress(userAddress) : "Connect Wallet"}
    </button>
  );
}
