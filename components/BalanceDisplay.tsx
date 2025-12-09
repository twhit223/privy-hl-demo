'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useMemo } from 'react';
import { createPublicClient, http, formatUnits, getAddress } from 'viem';
import { arbitrum } from 'viem/chains';
import * as hl from '@nktkas/hyperliquid';
import { throttleRequest } from '@/utils/apiThrottle';

// USDC contract addresses
const USDC_MAINNET = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

// ERC-20 ABI for balanceOf
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
] as const;

export function BalanceDisplay() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  
  const [balances, setBalances] = useState<{
    arbitrumMainnet: string | null;
    arbitrumETH: string | null;
    hyperliquidMainnet: string | null;
    hyperliquidTestnet: string | null;
  }>({
    arbitrumMainnet: null,
    arbitrumETH: null,
    hyperliquidMainnet: null,
    hyperliquidTestnet: null,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchBalances = async () => {
    if (ethereumWallets.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const walletAddress = ethereumWallets[0].address as `0x${string}`;
      const checksummedAddress = getAddress(walletAddress);

      // Create public client for Arbitrum mainnet
      const arbitrumClient = createPublicClient({
        chain: arbitrum,
        transport: http(),
      });

      // Fetch Arbitrum mainnet USDC balance
      let arbitrumMainnetBalance = '0';
      try {
        const balance = await arbitrumClient.readContract({
          address: getAddress(USDC_MAINNET),
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [checksummedAddress],
        });
        arbitrumMainnetBalance = formatUnits(balance as bigint, 6); // USDC has 6 decimals
      } catch (err) {
        console.error('Error fetching Arbitrum mainnet balance:', err);
        arbitrumMainnetBalance = 'Error';
      }

      // Fetch Arbitrum ETH balance
      let arbitrumETHBalance = '0';
      try {
        const balance = await arbitrumClient.getBalance({
          address: checksummedAddress,
        });
        arbitrumETHBalance = formatUnits(balance, 18); // ETH has 18 decimals
      } catch (err) {
        console.error('Error fetching Arbitrum ETH balance:', err);
        arbitrumETHBalance = 'Error';
      }

      // Fetch Hyperliquid mainnet balance
      let hyperliquidMainnetBalance = '0';
      try {
        const mainnetState = await throttleRequest(
          `balance-mainnet-${checksummedAddress}`,
          async () => {
            const mainnetTransport = new hl.HttpTransport({ isTestnet: false });
            const mainnetInfoClient = new hl.InfoClient({ transport: mainnetTransport });
            
            // Use clearinghouseState to get user USDC balance (withdrawable amount)
            return await mainnetInfoClient.clearinghouseState({
              user: checksummedAddress,
            });
          },
          2000 // Minimum 2 seconds between balance requests
        );
        
        // The withdrawable field represents the USDC balance available for withdrawal
        const balanceValue = parseFloat(mainnetState.withdrawable || '0');
        hyperliquidMainnetBalance = balanceValue.toFixed(2);
      } catch (err) {
        console.error('Error fetching Hyperliquid mainnet balance:', err);
        // If user doesn't exist on Hyperliquid, balance is 0
        if (err instanceof Error && (err.message.includes('does not exist') || err.message.includes('not found'))) {
          hyperliquidMainnetBalance = '0';
        } else {
          hyperliquidMainnetBalance = 'Error';
        }
      }

      // Fetch Hyperliquid testnet balance
      let hyperliquidTestnetBalance = '0';
      try {
        const testnetState = await throttleRequest(
          `balance-testnet-${checksummedAddress}`,
          async () => {
            const testnetTransport = new hl.HttpTransport({ isTestnet: true });
            const testnetInfoClient = new hl.InfoClient({ transport: testnetTransport });
            
            return await testnetInfoClient.clearinghouseState({
              user: checksummedAddress,
            });
          },
          2000 // Minimum 2 seconds between balance requests
        );
        
        const balanceValue = parseFloat(testnetState.withdrawable || '0');
        hyperliquidTestnetBalance = balanceValue.toFixed(2);
      } catch (err) {
        console.error('Error fetching Hyperliquid testnet balance:', err);
        if (err instanceof Error && (err.message.includes('does not exist') || err.message.includes('not found'))) {
          hyperliquidTestnetBalance = '0';
        } else {
          hyperliquidTestnetBalance = 'Error';
        }
      }

        setBalances({
          arbitrumMainnet: arbitrumMainnetBalance,
          arbitrumETH: arbitrumETHBalance,
          hyperliquidMainnet: hyperliquidMainnetBalance,
          hyperliquidTestnet: hyperliquidTestnetBalance,
        });
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch balances when wallet is available
  useEffect(() => {
    if (authenticated && walletsReady && ethereumWallets.length > 0) {
      fetchBalances();
      // Refresh balances every 20 seconds (increased from 10s to reduce API calls)
      const interval = setInterval(fetchBalances, 20000);
      return () => clearInterval(interval);
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
          Please log in to view balances.
        </p>
      </div>
    );
  }

  if (ethereumWallets.length === 0) {
    return (
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No Ethereum wallet found.
        </p>
      </div>
    );
  }

  const formatBalance = (balance: string | null) => {
    if (balance === null) return 'Loading...';
    if (balance === 'Error') return 'Error';
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatETHBalance = (balance: string | null) => {
    if (balance === null) return 'Loading...';
    if (balance === 'Error') return 'Error';
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.000000';
    return num.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  };

  return (
    <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Balances</h2>
        <button
          onClick={fetchBalances}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-800 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Arbitrum ETH
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">On-chain</span>
          </div>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {formatETHBalance(balances.arbitrumETH)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">ETH</p>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-800 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Arbitrum Mainnet USDC
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">On-chain</span>
          </div>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {formatBalance(balances.arbitrumMainnet)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">USDC</p>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-800 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Hyperliquid Mainnet USDC
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">On Hyperliquid</span>
          </div>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {formatBalance(balances.hyperliquidMainnet)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">USDC</p>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-800 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Hyperliquid Testnet USDC
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">On Hyperliquid</span>
          </div>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {formatBalance(balances.hyperliquidTestnet)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">USDC</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> Balances auto-refresh every 10 seconds. Click "Refresh" to update manually.
        </p>
      </div>
    </div>
  );
}

