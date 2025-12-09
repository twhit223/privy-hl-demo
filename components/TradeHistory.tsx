'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useMemo } from 'react';
import { getAddress } from 'viem';
import * as hl from '@nktkas/hyperliquid';
import { useNetwork } from '@/contexts/NetworkContext';
import { throttleRequest } from '@/utils/apiThrottle';

interface Trade {
  coin: string;
  side: 'B' | 'A'; // B = Buy, A = Sell
  px: string;
  sz: string;
  time: number;
  closedPnl?: string;
  oid: number;
  hash: string;
}

export function TradeHistory() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Network context
  const { isTestnet } = useNetwork();

  const fetchTradeHistory = async () => {
    if (ethereumWallets.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const walletAddress = ethereumWallets[0].address as `0x${string}`;
      const checksummedAddress = getAddress(walletAddress);

      // Initialize InfoClient
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });

      // Fetch user fills/trades using Hyperliquid API with throttling
      // Hyperliquid uses POST /info endpoint with type: 'userFills'
      let userFills: any[] = [];
      
      try {
        userFills = await throttleRequest(
          `trades-${checksummedAddress}-${isTestnet}`,
          async () => {
            const apiUrl = isTestnet 
              ? 'https://api.hyperliquid-testnet.xyz/info'
              : 'https://api.hyperliquid.xyz/info';
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'userFills',
                user: checksummedAddress,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              // Hyperliquid returns data in format: { data: [...] } or directly as array
              return Array.isArray(data) ? data : (data.data || data.fills || []);
            } else {
              const errorText = await response.text();
              console.error('API error response:', errorText);
              throw new Error(`Failed to fetch trades: ${response.status} ${response.statusText}`);
            }
          },
          3000 // Minimum 3 seconds between trade history requests
        );
      } catch (apiError) {
        console.error('Error fetching user fills:', apiError);
        // If user doesn't exist or has no trades, that's okay
        if (apiError instanceof Error && 
            (apiError.message.includes('does not exist') || 
             apiError.message.includes('not found') ||
             apiError.message.includes('404'))) {
          userFills = [];
        } else {
          throw apiError;
        }
      }

      // Process and sort trades (most recent first)
      const processedTrades: Trade[] = userFills
        .map((fill: any) => {
          const side: 'B' | 'A' = fill.side === 'B' || fill.side === 'buy' || fill.side === 'Buy' ? 'B' : 'A';
          return {
            coin: fill.coin || fill.symbol || 'Unknown',
            side,
            px: fill.px || fill.price || '0',
            sz: fill.sz || fill.size || fill.quantity || '0',
            time: fill.time || fill.timestamp || Date.now(),
            closedPnl: fill.closedPnl,
            oid: fill.oid || fill.orderId || 0,
            hash: fill.hash || fill.txHash || '',
          };
        })
        .sort((a, b) => b.time - a.time); // Sort by time descending

      setTrades(processedTrades);
    } catch (err) {
      console.error('Error fetching trade history:', err);
      if (err instanceof Error && (err.message.includes('does not exist') || err.message.includes('not found'))) {
        setTrades([]);
        setError(null); // No trades is not an error
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch trade history');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch trade history when wallet is available or network changes
  useEffect(() => {
    if (authenticated && walletsReady && ethereumWallets.length > 0) {
      fetchTradeHistory();
      // Refresh every 60 seconds (increased from 30s to reduce API calls)
      const interval = setInterval(fetchTradeHistory, 60000);
      return () => clearInterval(interval);
    }
  }, [authenticated, walletsReady, ethereumWallets.length, isTestnet]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatNumber = (value: string | number, decimals: number = 2) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
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
          Please log in to view trade history.
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Trade History</h2>
        <button
          onClick={fetchTradeHistory}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {isLoading && trades.length === 0 ? (
        <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
          Loading trade history...
        </div>
      ) : trades.length === 0 ? (
        <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
          No trades found. Start trading to see your history here.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-300 dark:border-zinc-700">
                  <th className="text-left py-2 px-3 font-medium text-zinc-700 dark:text-zinc-300">Time</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-700 dark:text-zinc-300">Asset</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-700 dark:text-zinc-300">Side</th>
                  <th className="text-right py-2 px-3 font-medium text-zinc-700 dark:text-zinc-300">Price</th>
                  <th className="text-right py-2 px-3 font-medium text-zinc-700 dark:text-zinc-300">Size</th>
                  <th className="text-right py-2 px-3 font-medium text-zinc-700 dark:text-zinc-300">Value</th>
                  {trades.some(t => t.closedPnl) && (
                    <th className="text-right py-2 px-3 font-medium text-zinc-700 dark:text-zinc-300">P&L</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(isExpanded ? trades : trades.slice(0, 5)).map((trade, index) => {
                const value = parseFloat(trade.px) * parseFloat(trade.sz);
                const isBuy = trade.side === 'B';
                return (
                  <tr
                    key={`${trade.oid}-${trade.time}-${index}`}
                    className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">
                      {formatDate(trade.time)}
                    </td>
                    <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {trade.coin}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          isBuy
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {isBuy ? 'BUY' : 'SELL'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                      ${formatNumber(trade.px)}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                      {formatNumber(trade.sz, 6)}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                      ${formatNumber(value)}
                    </td>
                    {trades.some(t => t.closedPnl) && (
                      <td className="py-2 px-3 text-right">
                        {trade.closedPnl ? (
                          <span
                            className={`font-semibold ${
                              parseFloat(trade.closedPnl) >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {parseFloat(trade.closedPnl) >= 0 ? '+' : ''}
                            ${formatNumber(trade.closedPnl)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
          
          {trades.length > 5 && (
            <div className="mt-4 flex items-center justify-center">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                {isExpanded 
                  ? `Show Less (${trades.length} total)` 
                  : `Show All (${trades.length} total)`}
              </button>
            </div>
          )}
          
          {trades.length > 0 && (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 text-center">
              Showing {isExpanded ? trades.length : Math.min(5, trades.length)} of {trades.length} {trades.length === 1 ? 'trade' : 'trades'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

