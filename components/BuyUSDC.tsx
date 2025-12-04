'use client';

import { usePrivy, useWallets, useFundWallet } from '@privy-io/react-auth';
import { useState, useMemo } from 'react';
import { arbitrum } from 'viem/chains';

export function BuyUSDC() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { fundWallet } = useFundWallet();
  
  const [amount, setAmount] = useState<string>('10');
  const [isFunding, setIsFunding] = useState(false);
  const [fundingResult, setFundingResult] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
  } | null>(null);

  // Get Ethereum embedded wallets
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

  const handleBuyUSDC = async () => {
    if (!amount || parseFloat(amount) < 5) {
      setFundingResult({
        success: false,
        message: 'Minimum purchase is $5',
      });
      return;
    }

    if (ethereumWallets.length === 0) {
      setFundingResult({
        success: false,
        message: 'No Ethereum wallet found',
      });
      return;
    }

    if (!fundWallet) {
      setFundingResult({
        success: false,
        message: 'Wallet funding is not enabled. Please enable it in your Privy dashboard.',
      });
      return;
    }

    setIsFunding(true);
    setFundingResult(null);

    try {
      const primaryWallet = ethereumWallets[0];
      
      // Fund wallet with USDC on Arbitrum
      // Privy's fundWallet will open a modal with payment options including Apple Pay/Google Pay
      // Users can pay with Apple Pay/Google Pay without signing up for Coinbase or MoonPay
      // Privy handles the payment processing in the background
      const result = await fundWallet({
        address: primaryWallet.address,
        options: {
          chain: arbitrum, // Arbitrum mainnet
          asset: 'USDC', // Fund with USDC
          amount: amount, // Amount in USD
        },
      });

      if (result.status === 'completed') {
        setFundingResult({
          success: true,
          message: `Successfully purchased $${amount} USDC on Arbitrum!`,
          txHash: result.transactionHash,
        });
      } else {
        setFundingResult({
          success: false,
          message: 'Funding was cancelled',
        });
      }
    } catch (error) {
      console.error('Error funding wallet:', error);
      
      let errorMessage = 'Failed to purchase USDC';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for funding not enabled error
        if (error.message.includes('not enabled') || error.message.includes('funding') || error.message.includes('disabled')) {
          errorMessage = 'Wallet funding is not enabled. Please enable it in your Privy dashboard.';
        }
      }
      
      setFundingResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setIsFunding(false);
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
          Please log in to buy USDC.
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

  const explorerUrl = `https://arbiscan.io/tx/`;

  return (
    <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold mb-4">Step 3.5: Buy USDC on Arbitrum</h2>
      
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            <strong>Important:</strong> To initialize your Hyperliquid account on mainnet, you need USDC on Arbitrum.
            After initializing on mainnet, you can claim testnet funds (once per address).
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            This step allows you to buy USDC directly to your wallet using Apple Pay or credit card.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Amount to Buy (USD) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
              min="5"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Minimum: $5 USD • You'll receive USDC on Arbitrum
            </p>
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Payment Options:</strong> You can pay with Apple Pay or Google Pay (if available on your device), 
              or use a credit/debit card. No sign-up required for Coinbase or MoonPay - Privy handles everything!
              USDC will be sent directly to your wallet on Arbitrum.
            </p>
          </div>

          <button
            onClick={handleBuyUSDC}
            disabled={isFunding || !amount || parseFloat(amount) < 5}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {isFunding ? 'Processing...' : 'Buy USDC with Apple Pay / Card'}
          </button>

          {fundingResult && (
            <div
              className={`p-4 rounded-lg border ${
                fundingResult.success
                  ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                  : 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
              }`}
            >
              <p
                className={`font-semibold mb-2 ${
                  fundingResult.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}
              >
                {fundingResult.success ? '✓ Purchase Successful' : '✗ Purchase Failed'}
              </p>
              <p
                className={`text-sm ${
                  fundingResult.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                {fundingResult.message}
              </p>
              {!fundingResult.success && fundingResult.message.includes('not enabled') && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                    How to enable wallet funding:
                  </p>
                  <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Go to your Privy Dashboard: <a href="https://dashboard.privy.io" target="_blank" rel="noopener noreferrer" className="underline">dashboard.privy.io</a></li>
                    <li>Select your app (App ID: {process.env.NEXT_PUBLIC_PRIVY_APP_ID})</li>
                    <li>Navigate to <strong>"User management" → "Account funding"</strong></li>
                    <li>Enable <strong>"Pay with card"</strong></li>
                    <li>Set your desired network (Arbitrum) and recommended amount</li>
                    <li>Save the changes and refresh this page</li>
                  </ol>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    <strong>Note:</strong> Once enabled, users can pay with Apple Pay/Google Pay directly without 
                    signing up for Coinbase or MoonPay. Privy handles the payment processing in the background.
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    <strong>Alternative:</strong> You can manually send USDC to your wallet address from an exchange or another wallet.
                  </p>
                </div>
              )}
              {fundingResult.success && fundingResult.txHash && (
                <div className="mt-3">
                  <a
                    href={`${explorerUrl}${fundingResult.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View on Arbiscan →
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              What happens next:
            </p>
            <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Complete the purchase using Apple Pay or card</li>
              <li>USDC will be sent directly to your wallet on Arbitrum</li>
              <li>Use the USDC to initialize your Hyperliquid account on mainnet (next step)</li>
              <li>After mainnet initialization, you can claim testnet funds</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

