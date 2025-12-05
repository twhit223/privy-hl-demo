'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useMemo } from 'react';
import { getAddress } from 'viem';
import * as hl from '@nktkas/hyperliquid';

interface Position {
  asset: number;
  assetName: string;
  side: 'long' | 'short';
  size: string;
  entryPx: string;
  currentPx: string | null;
  fundingRate: string | null;
  leverage: string;
  unrealizedPnl: string;
  liquidationPx: string;
}

interface AccountSummary {
  accountValue: string;
  totalNtlPos: string;
  unrealizedPnl: string;
  withdrawable: string;
  marginUsed: string;
  crossMaintenanceMarginUsed: string;
  crossMarginRatio: string;
  crossAccountLeverage: string;
}

export function ViewPositions() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
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

  const fetchPositions = async () => {
    if (ethereumWallets.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const isTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET === 'true';
      const walletAddress = ethereumWallets[0].address as `0x${string}`;
      const checksummedAddress = getAddress(walletAddress);

      // Initialize InfoClient for testnet
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });

      // Get user clearinghouse state (positions, balance, margin)
      const clearinghouseState = await infoClient.clearinghouseState({
        user: checksummedAddress,
      });

      // Get asset metadata and current prices
      const [meta, contexts] = await infoClient.metaAndAssetCtxs();
      const assetMap: Record<number, string> = {};
      meta.universe?.forEach((asset, index) => {
        assetMap[index] = asset.name || `Asset ${index}`;
      });

      // Parse positions from clearinghouseState
      const openPositions: Position[] = [];
      let totalUnrealizedPnl = 0;
      
      if (clearinghouseState.assetPositions) {
        clearinghouseState.assetPositions.forEach((pos) => {
          const size = parseFloat(pos.position.szi || '0');
          if (Math.abs(size) > 0) {
            // Only include non-zero positions
            // Use the 'coin' field directly from position data as it's more reliable
            // Fallback to asset ID mapping if coin field is not available
            const assetNameFromCoin = pos.position.coin;
            const assetId = (pos.position as any).asset || 0;
            const assetNameFromMap = assetMap[assetId] || `Asset ${assetId}`;
            const assetName = assetNameFromCoin || assetNameFromMap;
            const isLong = parseFloat(pos.position.szi || '0') > 0;
            
            // Try to find the asset ID from the asset name if we have the coin field
            let finalAssetId = assetId;
            if (assetNameFromCoin) {
              // Find the asset ID by matching the coin name in the universe
              const foundAssetIndex = meta.universe?.findIndex((a) => a.name === assetNameFromCoin);
              if (foundAssetIndex !== undefined && foundAssetIndex !== -1) {
                finalAssetId = foundAssetIndex;
              }
            }
            
            // Get current price (mark price) for this asset
            let currentPrice: string | null = null;
            if (finalAssetId !== undefined && contexts[finalAssetId]?.markPx) {
              currentPrice = contexts[finalAssetId].markPx;
            }
            
            // Get funding rate for this asset
            let fundingRate: string | null = null;
            if (finalAssetId !== undefined && contexts[finalAssetId]) {
              const context = contexts[finalAssetId] as any;
              // Try different possible field names for funding rate
              const fundingValue = context.funding || context.fundingRate || context.premium || null;
              if (fundingValue !== null && fundingValue !== undefined) {
                // Funding rate is typically provided as a decimal (e.g., 0.0001 = 0.01%)
                // Convert to percentage for display
                const funding = parseFloat(fundingValue);
                if (!isNaN(funding)) {
                  fundingRate = (funding * 100).toFixed(4); // Convert to percentage with 4 decimal places
                }
              }
            }
            
            // Sum up unrealized PnL from all positions
            const positionUnrealizedPnl = parseFloat(pos.position.unrealizedPnl || '0');
            totalUnrealizedPnl += positionUnrealizedPnl;
            
            openPositions.push({
              asset: finalAssetId,
              assetName,
              side: isLong ? 'long' : 'short',
              size: Math.abs(size).toFixed(6),
              entryPx: pos.position.entryPx || '0',
              currentPx: currentPrice,
              fundingRate,
              leverage: pos.position.leverage?.value || '1',
              unrealizedPnl: pos.position.unrealizedPnl || '0',
              liquidationPx: pos.position.liquidationPx?.px || 'N/A',
            });
          }
        });
      }

      setPositions(openPositions);

      // Extract account summary from marginSummary and clearinghouseState
      const marginSummary = clearinghouseState.marginSummary;
      
      // Calculate cross margin ratio if available
      let crossMarginRatio = '0.00';
      const crossMaintenanceMarginUsed = (marginSummary as any)?.crossMaintenanceMarginUsed;
      if (crossMaintenanceMarginUsed && marginSummary?.accountValue) {
        const maintenance = parseFloat(crossMaintenanceMarginUsed);
        const accountVal = parseFloat(marginSummary.accountValue);
        if (accountVal > 0) {
          crossMarginRatio = ((maintenance / accountVal) * 100).toFixed(2);
        }
      }
      
      // Calculate cross account leverage if available
      let crossAccountLeverage = '0.00';
      if (marginSummary?.totalNtlPos && marginSummary?.accountValue) {
        const totalPos = parseFloat(marginSummary.totalNtlPos);
        const accountVal = parseFloat(marginSummary.accountValue);
        if (accountVal > 0) {
          crossAccountLeverage = (totalPos / accountVal).toFixed(2);
        }
      }
      
      setAccountSummary({
        accountValue: marginSummary?.accountValue || '0',
        totalNtlPos: marginSummary?.totalNtlPos || '0',
        unrealizedPnl: totalUnrealizedPnl.toFixed(2),
        withdrawable: clearinghouseState.withdrawable || '0',
        marginUsed: (marginSummary as any)?.marginUsed || '0',
        crossMaintenanceMarginUsed: crossMaintenanceMarginUsed || '0',
        crossMarginRatio,
        crossAccountLeverage,
      });
    } catch (err) {
      console.error('Error fetching positions:', err);
      if (err instanceof Error && (err.message.includes('does not exist') || err.message.includes('not found'))) {
        setPositions([]);
        setError(null); // User just doesn't have positions yet
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch positions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch positions when wallet is available
  useEffect(() => {
    if (authenticated && walletsReady && ethereumWallets.length > 0) {
      fetchPositions();
      // Refresh positions every 5 seconds
      const interval = setInterval(fetchPositions, 5000);
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
          Please log in to view positions.
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

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const formatPnl = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num >= 0 ? `+${formatted}` : formatted;
  };

  return (
    <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Open Positions</h2>
        <button
          onClick={fetchPositions}
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

      {/* Account Summary */}
      {accountSummary && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Account Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Account Value</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                ${formatNumber(accountSummary.accountValue)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Total Position Value</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                ${formatNumber(accountSummary.totalNtlPos)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Unrealized PnL</p>
              <p className={`text-lg font-semibold ${
                parseFloat(accountSummary.unrealizedPnl) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatPnl(accountSummary.unrealizedPnl)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Withdrawable</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                ${formatNumber(accountSummary.withdrawable)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Margin Used</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                ${formatNumber(accountSummary.marginUsed)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Maintenance Margin</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                ${formatNumber(accountSummary.crossMaintenanceMarginUsed)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Cross Margin Ratio</p>
              <p className={`text-sm font-medium ${
                parseFloat(accountSummary.crossMarginRatio) < 50
                  ? 'text-green-600 dark:text-green-400'
                  : parseFloat(accountSummary.crossMarginRatio) < 80
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {accountSummary.crossMarginRatio}%
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Cross Account Leverage</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {accountSummary.crossAccountLeverage}x
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading && positions.length === 0 && !error && (
        <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
          Loading positions...
        </div>
      )}

      {!isLoading && positions.length === 0 && !error && (
        <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
          No open positions found.
        </div>
      )}

      {positions.length > 0 && (
        <div className="space-y-3">
          {positions.map((position, index) => {
            const pnl = parseFloat(position.unrealizedPnl);
            const isProfit = pnl >= 0;
            
            return (
              <div
                key={`${position.asset}-${index}`}
                className="p-4 bg-white dark:bg-zinc-800 border rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {position.assetName}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          position.side === 'long'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {position.side.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Asset ID: {position.asset}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        isProfit
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatPnl(position.unrealizedPnl)} USDC
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Unrealized PnL</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Size</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatNumber(position.size)} {position.assetName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Entry Price</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      ${formatNumber(position.entryPx)}
                    </p>
                    {position.currentPx && (
                      <>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 mt-1">Current Price</p>
                        <p className={`text-sm font-medium ${
                          parseFloat(position.currentPx) > parseFloat(position.entryPx)
                            ? 'text-green-600 dark:text-green-400'
                            : parseFloat(position.currentPx) < parseFloat(position.entryPx)
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}>
                          ${formatNumber(position.currentPx)}
                        </p>
                      </>
                    )}
                    {position.fundingRate !== null && (
                      <>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 mt-1">Funding Rate</p>
                        <p className={`text-sm font-medium ${
                          parseFloat(position.fundingRate) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {parseFloat(position.fundingRate) >= 0 ? '+' : ''}{position.fundingRate}%
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Leverage</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatNumber(position.leverage)}x
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Liquidation Price</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {position.liquidationPx === 'N/A' ? 'N/A' : `$${formatNumber(position.liquidationPx)}`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> Positions auto-refresh every 5 seconds. Click "Refresh" to update manually.
        </p>
      </div>
    </div>
  );
}

