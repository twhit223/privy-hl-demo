'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useMemo } from 'react';
import { getAddress } from 'viem';

export function TestnetFaucet() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  
  const [isClaiming, setIsClaiming] = useState(false);
  const [faucetResult, setFaucetResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

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

  const claimTestnetUSDC = async () => {
    if (ethereumWallets.length === 0) {
      setFaucetResult({
        success: false,
        message: 'No Ethereum wallet found. Please create a wallet first.',
      });
      return;
    }

    setIsClaiming(true);
    setFaucetResult(null);

    try {
      const primaryWallet = ethereumWallets[0];
      const address = getAddress(primaryWallet.address) as `0x${string}`;

      // Claim testnet USDC from faucet
      // According to Privy guide: https://docs.privy.io/recipes/hyperliquid-guide
      // The faucet is accessed via a simple POST to /info endpoint
      // No signing required - just send the wallet address
      // Note: This requires a mainnet deposit first (at least $5 USDC, but guide says $10)
      
      const response = await fetch('https://api.hyperliquid-testnet.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'claimDrip',
          user: address,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();

      setFaucetResult({
        success: true,
        message: 'Successfully claimed 1,000 testnet USDC!',
        data: result,
      });
    } catch (error) {
      console.error('Error claiming testnet USDC:', error);
      let errorMessage = 'Failed to claim testnet USDC';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle common error cases
        if (error.message.includes('already claimed') || error.message.includes('already used')) {
          errorMessage = 'You have already claimed testnet USDC. The faucet can only be used once per account.';
        } else if (error.message.includes('deposit') || error.message.includes('mainnet')) {
          errorMessage = 'You must deposit at least 10 USDC on Hyperliquid mainnet before claiming testnet USDC.';
        } else if (error.message.includes('does not exist')) {
          errorMessage = 'Your Hyperliquid account does not exist. Please deposit funds on mainnet first (Step 4).';
        }
      }
      
      setFaucetResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setIsClaiming(false);
    }
  };

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
          Please log in to claim testnet USDC.
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
      <h2 className="text-xl font-semibold mb-4">Request Testnet USDC from Hyperliquid</h2>
      
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            <strong>Important:</strong> To claim testnet USDC, you must first deposit at least $5 USDC on Hyperliquid mainnet (Step 4).
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            • The faucet grants $1,000 mock USDC for testing<br/>
            • You can only claim once per address<br/>
            • Mainnet deposit is required to activate your account
          </p>
        </div>

        {faucetResult && (
          <div className={`p-4 rounded-lg ${
            faucetResult.success 
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
          }`}>
            <p className={`text-sm ${
              faucetResult.success 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>
              {faucetResult.message}
            </p>
            {faucetResult.data && (
              <pre className="mt-2 text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-auto">
                {JSON.stringify(faucetResult.data, null, 2)}
              </pre>
            )}
          </div>
        )}

        <button
          onClick={claimTestnetUSDC}
          disabled={isClaiming}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
            isClaiming
              ? 'bg-zinc-400 dark:bg-zinc-700 text-zinc-200 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isClaiming ? 'Claiming Testnet USDC...' : 'Claim 1,000 Testnet USDC'}
        </button>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          Wallet: {ethereumWallets[0].address.slice(0, 6)}...{ethereumWallets[0].address.slice(-4)}
        </p>
      </div>
    </div>
  );
}

