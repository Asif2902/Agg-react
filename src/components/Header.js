import React from 'react';
import { WalletButton } from '../wallet/WalletButton';

export function Header() {
  return (
    <header>
      <h2>Mon bridge Dex</h2>
      <WalletButton />
    </header>
  );
}
