'use client';

import { usePrivy, useWallets, useSignTypedData } from '@privy-io/react-auth';
import { useState, useMemo } from 'react';
import * as hl from '@nktkas/hyperliquid';
import type { AbstractViemLocalAccount } from '@nktkas/hyperliquid/signing';

export function PlaceOrder() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTypedData: privySignTypedData } = useSignTypedData();
  
  // Form state - Fixed to BTC market orders
  const BTC_ASSET_ID = 0; // BTC asset ID
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [size, setSize] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

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

  const placeOrder = async () => {
    if (!size || ethereumWallets.length === 0) {
      setOrderResult({
        success: false,
        message: 'Please enter a size and ensure you have a wallet.',
      });
      return;
    }

    setIsSubmitting(true);
    setOrderResult(null);

    try {
      const isTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET === 'true';
      const primaryWallet = ethereumWallets[0];
      const address = primaryWallet.address as `0x${string}`;
      
      // Create a viem LocalAccount adapter
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
          const result = await privySignTypedData({
            domain: params.domain,
            types: params.types,
            primaryType: params.primaryType,
            message: params.message,
          });
          return result.signature as `0x${string}`;
        },
      };

      // Initialize Hyperliquid transport and client
      const transport = new hl.HttpTransport({
        isTestnet: isTestnet,
      });

      const client = new hl.ExchangeClient({
        transport,
        wallet,
      });

      // Place market order (IOC - Immediate Or Cancel)
      // For market orders, we use a very high price for buys and 0 for sells
      // The IOC time-in-force ensures it fills at the best available market price
      const marketPrice = side === 'buy' ? '999999' : '0';
      
      const result = await client.order({
        orders: [
          {
            a: BTC_ASSET_ID, // Fixed to BTC (asset ID 0)
            b: side === 'buy', // true for long/buy, false for short/sell
            p: marketPrice, // Market price (IOC will fill at best available price)
            s: size, // Size as string
            r: false, // Not reduce-only
            t: {
              limit: {
                tif: 'Ioc', // Immediate Or Cancel - market order behavior
              },
            },
          },
        ],
        grouping: 'na', // Standard order grouping
      });

      setOrderResult({
        success: true,
        message: 'Order placed successfully!',
        data: result,
      });
    } catch (error) {
      console.error('Error placing order:', error);
      
      // Check for specific Hyperliquid errors
      let errorMessage = 'Failed to place order';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check if wallet doesn't exist (needs funding first)
        if (error.message.includes('does not exist')) {
          errorMessage = 'Your wallet is not registered on Hyperliquid. You need to deposit funds first to activate your account. Please proceed to the funding step.';
        }
      }
      
      setOrderResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
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
          Please log in to place orders.
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
      <h2 className="text-xl font-semibold mb-4">Step 5: Place Market Order</h2>
      
      <div className="space-y-4">
        {/* Fixed Asset Display */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Asset: BTC (Bitcoin)
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Asset ID: {BTC_ASSET_ID} • Market Order (IOC)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Side
            </label>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as 'buy' | 'sell')}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="buy">Buy (Long)</option>
              <option value="sell">Sell (Short)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Size <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="0.1"
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Order size in BTC
            </p>
          </div>
        </div>

        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Market Order:</strong> This order will execute immediately at the best available market price. 
            Any unfilled portion will be canceled (IOC - Immediate Or Cancel).
          </p>
        </div>

        <button
          onClick={placeOrder}
          disabled={isSubmitting || !size}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Placing Market Order...' : 'Place Market Order'}
        </button>

        {orderResult && (
          <div
            className={`p-4 rounded-lg border ${
              orderResult.success
                ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                : 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
            }`}
          >
            <p
              className={`font-semibold mb-2 ${
                orderResult.success
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}
            >
              {orderResult.success ? '✓ Order Placed' : '✗ Order Failed'}
            </p>
            <p
              className={`text-sm ${
                orderResult.success
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {orderResult.message}
            </p>
            {orderResult.success && orderResult.data && (
              <div className="mt-3 text-xs text-green-700 dark:text-green-300">
                <pre className="bg-green-50 dark:bg-green-900/50 p-2 rounded overflow-auto">
                  {JSON.stringify(orderResult.data, null, 2)}
                </pre>
              </div>
            )}
            {!orderResult.success && orderResult.message.includes('does not exist') && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Next Step:</strong> Before placing orders, you need to deposit funds to Hyperliquid to activate your account. 
                  This is covered in the funding steps of the quickstart guide.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

