'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Network = 'testnet' | 'mainnet';

interface NetworkContextType {
  network: Network;
  isTestnet: boolean;
  setNetwork: (network: Network) => void;
  toggleNetwork: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
  defaultNetwork?: Network;
}

export function NetworkProvider({ children, defaultNetwork }: NetworkProviderProps) {
  // Initialize from env var if no defaultNetwork provided
  const envIsTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET === 'true';
  const initialNetwork = defaultNetwork || (envIsTestnet ? 'testnet' : 'mainnet');
  
  const [network, setNetworkState] = useState<Network>(initialNetwork);

  // Persist network choice to localStorage
  useEffect(() => {
    localStorage.setItem('hyperliquid-network', network);
  }, [network]);

  // Load network from localStorage on mount
  useEffect(() => {
    const savedNetwork = localStorage.getItem('hyperliquid-network') as Network | null;
    if (savedNetwork === 'testnet' || savedNetwork === 'mainnet') {
      setNetworkState(savedNetwork);
    }
  }, []);

  const setNetwork = (newNetwork: Network) => {
    setNetworkState(newNetwork);
  };

  const toggleNetwork = () => {
    setNetworkState((prev) => (prev === 'testnet' ? 'mainnet' : 'testnet'));
  };

  return (
    <NetworkContext.Provider
      value={{
        network,
        isTestnet: network === 'testnet',
        setNetwork,
        toggleNetwork,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
