'use client';

import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import { useState, useEffect, useMemo } from 'react';

export function WalletSetup() {
  // All hooks must be called at the top, before any conditional returns
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const [isCreating, setIsCreating] = useState(false);

  // Get Ethereum embedded wallets - check for any EIP-155 chain
  // This must be called before any conditional returns
  const ethereumWallets = useMemo(() => {
    return wallets.filter(
      (wallet) => {
        const chainId = wallet.chainId;
        return chainId === 'eip155:1' || 
               chainId === 'eip155:42161' || // Arbitrum
               chainId?.startsWith('eip155:');
      }
    );
  }, [wallets]);

  // Debug: Log all wallets to see what we're getting
  useEffect(() => {
    if (authenticated && walletsReady) {
      console.log('All wallets:', wallets);
      console.log('Wallet details:', wallets.map(w => ({
        address: w.address,
        chainId: w.chainId,
        walletClientType: w.walletClientType,
      })));
    }
  }, [authenticated, walletsReady, wallets]);

  // Now we can do conditional returns after all hooks
  if (!ready || !walletsReady) {
    return (
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading wallets...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Please log in to view your wallets. Privy will automatically create an embedded wallet for you when you log in.
        </p>
      </div>
    );
  }

  const handleCreateWallet = async () => {
    if (!createWallet) {
      console.error('createWallet not available');
      return;
    }
    
    setIsCreating(true);
    try {
      await createWallet();
    } catch (error) {
      console.error('Error creating wallet:', error);
      alert('Error creating wallet. You may already have an embedded wallet. Check the browser console for details.');
    } finally {
      setIsCreating(false);
    }
  };

  if (ethereumWallets.length === 0) {
    return (
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No Ethereum wallets found. Create an embedded wallet to get started.
          </p>
          <button
            onClick={handleCreateWallet}
            disabled={isCreating || !createWallet}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Creating Wallet...' : 'Create Embedded Wallet'}
          </button>
          {wallets.length > 0 && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Found {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} (non-Ethereum)
            </div>
          )}
        </div>
      </div>
    );
  }

  const primaryWallet = ethereumWallets[0];

  return (
    <div className="w-full space-y-4">
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <h2 className="text-xl font-semibold mb-4">Step 3: Wallet Creation</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
            <p className="text-green-800 dark:text-green-200 font-semibold mb-2">
              ✓ Your Wallet
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Address:</span>
                <p className="font-mono text-xs mt-1 break-all text-zinc-600 dark:text-zinc-400">
                  {primaryWallet.address}
                </p>
              </div>
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Chain ID:</span>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">
                  {primaryWallet.chainId}
                </span>
              </div>
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Wallet Type:</span>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">
                  {primaryWallet.walletClientType}
                </span>
              </div>
            </div>
          </div>
          
          {ethereumWallets.length > 1 && (
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              You have {ethereumWallets.length} Ethereum wallet{ethereumWallets.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

