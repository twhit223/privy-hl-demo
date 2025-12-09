'use client';

import { usePrivy, useWallets, useSignTypedData } from '@privy-io/react-auth';
import { useState, useEffect, useMemo } from 'react';
import * as hl from '@nktkas/hyperliquid';
import type { AbstractViemLocalAccount } from '@nktkas/hyperliquid/signing';

export function HyperliquidClient() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTypedData: privySignTypedData } = useSignTypedData();
  const [clientStatus, setClientStatus] = useState<{
    initialized: boolean;
    error: string | null;
    network: string | null;
  }>({
    initialized: false,
    error: null,
    network: null,
  });
  const [isInitializing, setIsInitializing] = useState(false);

  // Get Ethereum embedded wallets
  const ethereumWallets = useMemo(() => {
    return wallets.filter(
      (wallet) => {
        const chainId = wallet.chainId;
        return chainId === 'eip155:1' || 
               chainId === 'eip155:42161' || 
               chainId?.startsWith('eip155:');
      }
    );
  }, [wallets]);

  const initializeClient = async () => {
    if (ethereumWallets.length === 0) {
      setClientStatus({
        initialized: false,
        error: 'No Ethereum wallet available',
        network: null,
      });
      return;
    }

    setIsInitializing(true);
    setClientStatus({ initialized: false, error: null, network: null });

    try {
      const isTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET === 'true';
      const primaryWallet = ethereumWallets[0];
      const address = primaryWallet.address as `0x${string}`;
      
      // Create a viem LocalAccount adapter that matches Hyperliquid's AbstractViemLocalAccount interface
      // Hyperliquid expects: { address: `0x${string}`, signTypedData: (params) => Promise<`0x${string}`> }
      const wallet: AbstractViemLocalAccount = {
        address: address,
        signTypedData: async (params: {
          domain: {
            name: string;
            version: string;
            chainId: number;
            verifyingContract: `0x${string}`;
          };
          types: {
            [key: string]: {
              name: string;
              type: string;
            }[];
          };
          primaryType: string;
          message: Record<string, unknown>;
        }) => {
          // Use Privy's signTypedData hook to sign typed data
          // Note: This will trigger Privy's signing modal
          const result = await privySignTypedData({
            domain: params.domain,
            types: params.types,
            primaryType: params.primaryType,
            message: params.message,
          });
          return result.signature as `0x${string}`;
        },
      };

      // Initialize Hyperliquid transport
      const transport = new hl.HttpTransport({
        isTestnet: isTestnet,
      });

      // Initialize ExchangeClient with the viem account
      const client = new hl.ExchangeClient({
        transport,
        wallet,
      });

      setClientStatus({
        initialized: true,
        error: null,
        network: isTestnet ? 'testnet' : 'mainnet',
      });
    } catch (error) {
      console.error('Error initializing Hyperliquid client:', error);
      setClientStatus({
        initialized: false,
        error: error instanceof Error ? error.message : 'Failed to initialize client',
        network: null,
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Auto-initialize when wallet is available
  useEffect(() => {
    if (authenticated && walletsReady && ethereumWallets.length > 0 && !clientStatus.initialized && !isInitializing) {
      initializeClient();
    }
  }, [authenticated, walletsReady, ethereumWallets.length]);

  if (!ready || !walletsReady) {
    return (
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Please log in to initialize the Hyperliquid client.
        </p>
      </div>
    );
  }

  if (ethereumWallets.length === 0) {
    return (
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No Ethereum wallet found. Please create a wallet first.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold mb-4">Step 4: Hyperliquid Client</h2>
      
      <div className="space-y-4">
        {clientStatus.initialized ? (
          <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
            <p className="text-green-800 dark:text-green-200 font-semibold mb-2">
              ✓ Hyperliquid Client Initialized
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Network:</span>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">
                  {clientStatus.network}
                </span>
              </div>
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Wallet Address:</span>
                <p className="font-mono text-xs mt-1 break-all text-zinc-600 dark:text-zinc-400">
                  {ethereumWallets[0].address}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {clientStatus.error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {clientStatus.error}
              </div>
            )}
            <button
              onClick={initializeClient}
              disabled={isInitializing || ethereumWallets.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {isInitializing ? 'Initializing...' : 'Initialize Hyperliquid Client'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

