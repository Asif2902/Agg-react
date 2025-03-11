import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { debounce } from '../utils';
import { defaultTokens } from '../constants';
import { useWalletContext } from '../wallet/WalletContext';

const aggregatorAddress = "0x5Dc186D5fDDb5A2A49635F2b1C2459db904F87a5";
const aggregatorABI = [
  "function getBestSwap(uint amountIn, address[] calldata path) external view returns (address routerAddress, uint amountOut)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, uint deadline) external returns (uint[] memory amounts)",
  "function getPriceImpact(address router, address tokenIn, address tokenOut, uint amountIn) external view returns (uint priceImpact)"
];

const wmonABI = [
  "function deposit() payable",
  "function withdraw(uint wad)"
];

function getRouterName(address) {
  const routerMap = {
    "0xb6091233aacacba45225a2b2121bbac807af4255": "Octoswap",
    "0xca810d095e90daae6e867c19df6d9a8c56db2c89": "Bean swap",
    "0x4ba4be2fb69e2aa059a551ce5d609ef5818dd72f": "Taya finance"
  };
  const normalizedAddress = address.toLowerCase();
  return routerMap[normalizedAddress] || address;
}

export function Swap() {
  const { provider, signer, userAddress } = useWalletContext();
  const [tokens, setTokens] = useState([
    ...defaultTokens,
    ...JSON.parse(localStorage.getItem('importedTokens') || '[]')
  ]);
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [fromAmount, setFromAmount] = useState("");
  const [fromBalance, setFromBalance] = useState("-");
  const [toBalance, setToBalance] = useState("-");
  const [estimatedOutput, setEstimatedOutput] = useState("-");
  const [bestRouter, setBestRouter] = useState("-");
  const [priceImpact, setPriceImpact] = useState("-");
  const [aggFee, setAggFee] = useState("-");
  const [showFromList, setShowFromList] = useState(false);
  const [showToList, setShowToList] = useState(false);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");

  const aggregatorContract = signer ? new ethers.Contract(aggregatorAddress, aggregatorABI, signer) : null;

  async function importToken(address) {
    try {
      const tokenContract = new ethers.Contract(address, [
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint)"
      ], provider);
      const symbol = await tokenContract.symbol();
      const decimals = await tokenContract.decimals();
      const logo = "?";
      const token = { symbol, address, decimals, logo };
      const newTokens = [...tokens, token];
      setTokens(newTokens);
      localStorage.setItem(
        'importedTokens',
        JSON.stringify(newTokens.filter(t => !defaultTokens.find(dt => dt.address === t.address)))
      );
      window.notify("Token imported: " + symbol, "success");
      return token;
    } catch (error) {
      console.error(error);
      window.notify("Failed to import token", "error");
      return null;
    }
  }

  async function fetchTokenBalance(token, side) {
    if (!provider || !userAddress) return;
    try {
      let balance;
      if (token.symbol === "MON") {
        balance = await provider.getBalance(userAddress);
        balance = ethers.utils.formatEther(balance);
      } else {
        const tokenContract = new ethers.Contract(token.address, ["function balanceOf(address) view returns (uint)"], provider);
        balance = await tokenContract.balanceOf(userAddress);
        balance = ethers.utils.formatUnits(balance, token.decimals);
      }
      if (side === "from") setFromBalance(balance);
      else setToBalance(balance);
    } catch (err) {
      console.error(err);
    }
  }

  async function estimateSwap() {
    if (!fromToken || !toToken || !fromAmount || isNaN(fromAmount)) return;
    
    if (!provider || !userAddress || !aggregatorContract) {
      if (!window._walletWarningNotified) {
        window.notify("Please connect wallet to check price", "error");
        window._walletWarningNotified = true;
      }
      setEstimatedOutput("-");
      setBestRouter("-");
      setPriceImpact("-");
      setAggFee("-");
      return;
    }
    
    if ((fromToken.symbol === "MON" && toToken.symbol === "WMON") || (fromToken.symbol === "WMON" && toToken.symbol === "MON")) {
      setEstimatedOutput(fromAmount);
      setBestRouter("N/A");
      setPriceImpact("0%");
    } else {
      let amountInParsed;
      if (fromToken.symbol === "MON") {
        amountInParsed = ethers.utils.parseEther(fromAmount);
      } else {
        amountInParsed = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
      }
      let path;
      const wmonToken = defaultTokens.find(t => t.symbol === "WMON");
      if (fromToken.symbol === "MON" || toToken.symbol === "MON") {
        path = fromToken.symbol === "MON" ? [wmonToken.address, toToken.address] : [fromToken.address, wmonToken.address];
      } else {
        path = [fromToken.address, toToken.address];
      }
      try {
        const deadline = Math.floor(Date.now() / 1000) + 1800;
        const bestSwap = await aggregatorContract.getBestSwap(amountInParsed, path);
        setEstimatedOutput(ethers.utils.formatUnits(bestSwap[1], toToken.decimals));
        setBestRouter(getRouterName(bestSwap[0]));
        try {
          const priceImp = await aggregatorContract.getPriceImpact(bestSwap[0], path[0], path[1], amountInParsed);
          setPriceImpact((parseFloat(ethers.utils.formatUnits(priceImp, 18)) * 100).toFixed(2) + "%");
        } catch (err) {
          setPriceImpact("N/A");
        }
      } catch (error) {
        console.error(error);
        window.notify("Estimation failed", "error");
      }
    }
    let fee;
    if (fromToken.symbol === "MON") {
      fee = ethers.utils.parseEther(fromAmount).div(1000);
      setAggFee(ethers.utils.formatEther(fee) + " MON");
    } else {
      fee = ethers.utils.parseUnits(fromAmount, fromToken.decimals).div(1000);
      setAggFee(ethers.utils.formatUnits(fee, fromToken.decimals) + " " + fromToken.symbol);
    }
  }

  useEffect(() => {
    const handler = debounce(estimateSwap, 200);
    handler();
  }, [fromAmount, fromToken, toToken]);

  useEffect(() => {
    if (!fromToken && !toToken) {
      const mon = defaultTokens.find(t => t.symbol === "MON");
      const usdt = defaultTokens.find(t => t.symbol === "USDT");
      if (mon && usdt) {
        setFromToken(mon);
        setToToken(usdt);
        fetchTokenBalance(mon, "from");
        fetchTokenBalance(usdt, "to");
        estimateSwap();
      }
    }
  }, []);

  const handleFromSearch = async (e) => {
    const term = e.target.value.trim().toLowerCase();
    setFromSearch(term);
    let filtered = tokens.filter(token => token.symbol.toLowerCase().includes(term));
    if (term.startsWith("0x") && term.length === 42) {
      const exists = tokens.find(t => t.address.toLowerCase() === term);
      if (!exists) {
        const importedToken = await importToken(term);
        if (importedToken) {
          filtered = tokens.filter(token => token.symbol.toLowerCase().includes(term) || token.address.toLowerCase() === term);
        }
      } else {
        filtered = [exists];
      }
    }
    return filtered;
  };

  const handleToSearch = async (e) => {
    const term = e.target.value.trim().toLowerCase();
    setToSearch(term);
    let filtered = tokens.filter(token => token.symbol.toLowerCase().includes(term));
    if (term.startsWith("0x") && term.length === 42) {
      const exists = tokens.find(t => t.address.toLowerCase() === term);
      if (!exists) {
        const importedToken = await importToken(term);
        if (importedToken) {
          filtered = tokens.filter(token => token.symbol.toLowerCase().includes(term) || token.address.toLowerCase() === term);
        }
      } else {
        filtered = [exists];
      }
    }
    return filtered;
  };

  async function performSwap() {
    if (!fromToken || !toToken) {
      window.notify("Please select both tokens", "error");
      return;
    }
    if (!fromAmount || isNaN(fromAmount)) {
      window.notify("Enter a valid amount", "error");
      return;
    }
    let amountInParsed;
    if (fromToken.symbol === "MON") {
      amountInParsed = ethers.utils.parseEther(fromAmount);
    } else {
      amountInParsed = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
    }
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    try {
      let tx;
      if (fromToken.symbol === "MON" && toToken.symbol === "WMON") {
        const wmonToken = defaultTokens.find(t => t.symbol === "WMON");
        const wmonContract = new ethers.Contract(wmonToken.address, wmonABI, signer);
        tx = await wmonContract.deposit({ value: amountInParsed });
        window.notify("Wrapping in process: " + tx.hash, "info");
        await tx.wait();
        window.notify("Wrap successful!", "success");
        return;
      }
      else if (fromToken.symbol === "WMON" && toToken.symbol === "MON") {
        const wmonToken = defaultTokens.find(t => t.symbol === "WMON");
        const wmonContract = new ethers.Contract(wmonToken.address, wmonABI, signer);
        tx = await wmonContract.withdraw(amountInParsed);
        window.notify("Unwrapping in process: " + tx.hash, "info");
        await tx.wait();
        window.notify("Unwrap successful!", "success");
        return;
      }
      let path;
      const wmonToken = defaultTokens.find(t => t.symbol === "WMON");
      if (fromToken.symbol === "MON" || toToken.symbol === "MON") {
        path = fromToken.symbol === "MON" ? [wmonToken.address, toToken.address] : [fromToken.address, wmonToken.address];
      } else {
        path = [fromToken.address, toToken.address];
      }
      const bestSwap = await aggregatorContract.getBestSwap(amountInParsed, path);
      const amountOutMin = bestSwap[1].mul(95).div(100);
      if (fromToken.symbol === "MON") {
        tx = await aggregatorContract.swapExactETHForTokens(amountOutMin, path, deadline, { value: amountInParsed });
      } else if (toToken.symbol === "MON") {
        const tokenContract = new ethers.Contract(fromToken.address, ["function approve(address spender, uint amount) returns (bool)"], signer);
        const approveTx = await tokenContract.approve(aggregatorAddress, amountInParsed);
        await approveTx.wait();
        tx = await aggregatorContract.swapExactTokensForETH(amountInParsed, amountOutMin, path, deadline);
      } else {
        const tokenContract = new ethers.Contract(fromToken.address, ["function approve(address spender, uint amount) returns (bool)"], signer);
        const approveTx = await tokenContract.approve(aggregatorAddress, amountInParsed);
        await approveTx.wait();
        tx = await aggregatorContract.swapExactTokensForTokens(amountInParsed, amountOutMin, path, deadline);
      }
      window.notify("Swap transaction sent: " + tx.hash, "info");
      await tx.wait();
      window.notify("Swap successful!", "success");
    } catch (error) {
      console.error(error);
      window.notify("Swap failed", "error");
    }
  }

  return (
    <div className="swap-section">
      <div>
        <label>From</label>
        <div className="token-select" onClick={() => setShowFromList(!showFromList)}>
          <span id="fromTokenDisplay">
            <img
              id="fromTokenLogo"
              src={
                fromToken && fromToken.logo && fromToken.logo !== "?"
                  ? fromToken.logo
                  : "https://ttt.0xasif.monster/pngtree-orange-round-faq-icon-for-help-and-questions-vector-png-image_48543232-removebg-preview.png"
              }
              alt="Token Logo"
            />
            <span id="fromTokenSymbol">{fromToken ? fromToken.symbol : "Select Token"}</span>
          </span>
        </div>
        <div className="balance-display">Balance: <span id="fromBalance">{fromBalance}</span></div>
        {showFromList && (
          <div className="scrollable-tokens">
            <input 
              type="text" 
              placeholder="Search token symbol or paste contract address" 
              className="token-search" 
              value={fromSearch}
              onChange={handleFromSearch}
            />
            <div className="token-items">
              {tokens
                .filter(token => token.symbol.toLowerCase().includes(fromSearch))
                .map(token => (
                  <div key={token.address} className="token-item" onClick={() => {
                    setFromToken(token);
                    setShowFromList(false);
                    fetchTokenBalance(token, "from");
                    estimateSwap();
                  }}>
                    <img
                      src={token.logo && token.logo !== "?" ? token.logo : "https://ttt.0xasif.monster/pngtree-orange-round-faq-icon-for-help-and-questions-vector-png-image_48543232-removebg-preview.png"}
                      alt="Token Logo"
                    />
                    <span>{token.symbol}</span>
                  </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="switch-btn" onClick={() => {
          const temp = fromToken;
          setFromToken(toToken);
          setToToken(temp);
          if (temp) fetchTokenBalance(temp, "to");
          if (toToken) fetchTokenBalance(toToken, "from");
          estimateSwap();
      }}></div>
      <div>
        <label>To</label>
        <div className="token-select" onClick={() => setShowToList(!showToList)}>
          <span id="toTokenDisplay">
            <img
              id="toTokenLogo"
              src={
                toToken && toToken.logo && toToken.logo !== "?"
                  ? toToken.logo
                  : "https://ttt.0xasif.monster/pngtree-orange-round-faq-icon-for-help-and-questions-vector-png-image_48543232-removebg-preview.png"
              }
              alt="Token Logo"
            />
            <span id="toTokenSymbol">{toToken ? toToken.symbol : "Select Token"}</span>
          </span>
        </div>
        <div className="balance-display">Balance: <span id="toBalance">{toBalance}</span></div>
        {showToList && (
          <div className="scrollable-tokens">
            <input 
              type="text" 
              placeholder="Search token symbol or paste contract address" 
              className="token-search" 
              value={toSearch}
              onChange={handleToSearch}
            />
            <div className="token-items">
              {tokens
                .filter(token => token.symbol.toLowerCase().includes(toSearch))
                .map(token => (
                  <div key={token.address} className="token-item" onClick={() => {
                    setToToken(token);
                    setShowToList(false);
                    fetchTokenBalance(token, "to");
                    estimateSwap();
                  }}>
                    <img
                      src={token.logo && token.logo !== "?" ? token.logo : "https://ttt.0xasif.monster/pngtree-orange-round-faq-icon-for-help-and-questions-vector-png-image_48543232-removebg-preview.png"}
                      alt="Token Logo"
                    />
                    <span>{token.symbol}</span>
                  </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <input 
        type="number" 
        id="fromAmount" 
        placeholder="Amount" 
        value={fromAmount}
        onChange={e => setFromAmount(e.target.value)}
      />
      <div className="info-box" id="swapInfo">
        <div>Estimated Output: <span id="estimatedOutput">{estimatedOutput}</span></div>
        <div>Best Router: <span id="bestRouter">{bestRouter}</span></div>
        <div>Price Impact: <span id="priceImpact">{priceImpact}</span></div>
        <div>Aggregator Fee (0.1%): <span id="aggFee">{aggFee}</span></div>
      </div>
      <button id="swapButton" onClick={performSwap}>Swap</button>
    </div>
  );
}
