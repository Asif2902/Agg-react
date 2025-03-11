import React, { createContext, useContext, useState } from 'react';
import { ethers } from 'ethers';
import { CHAIN_ID, CHAIN_HEX } from '../constants';

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState(null);

  async function connectWallet() {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const prov = new ethers.providers.Web3Provider(window.ethereum);
        const sign = prov.getSigner();
        const addr = await sign.getAddress();
        setProvider(prov);
        setSigner(sign);
        setUserAddress(addr);
        const network = await prov.getNetwork();
        if (network.chainId !== CHAIN_ID) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: CHAIN_HEX }]
            });
          } catch (err) {
            console.error("Switch network error", err);
          }
        }
        return { provider: prov, signer: sign, userAddress: addr };
      } catch (e) {
        console.error(e);
        throw e;
      }
    } else {
      throw new Error("No Ethereum wallet found");
    }
  }

  return (
    <WalletContext.Provider value={{ provider, signer, userAddress, connectWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  return useContext(WalletContext);
}
