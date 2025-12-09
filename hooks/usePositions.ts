'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getAddress } from 'viem';
import * as hl from '@nktkas/hyperliquid';
import { useHyperliquidAssets } from '@/hooks/useHyperliquidAssets';
import { useHyperliquidPrices } from '@/hooks/useHyperliquidPrices';
import { useNetwork } from '@/contexts/NetworkContext';

export interface Position {
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

export interface AccountSummary {
  accountValue: string;
  totalNtlPos: string;
  unrealizedPnl: string;
  withdrawable: string;
  marginUsed: string;
  crossMaintenanceMarginUsed: string;
  crossMarginRatio: string;
  crossAccountLeverage: string;
}

export function usePositions() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { isTestnet } = useNetwork();
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use cached asset metadata
  const { assetMap, meta, isLoading: isLoadingAssets } = useHyperliquidAssets(isTestnet);
  const { fetchPrices, getPrice } = useHyperliquidPrices(isTestnet);

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

  const fetchPositions = useCallback(async () => {
    if (ethereumWallets.length === 0) return;
    
    // Wait for asset metadata to be loaded before processing positions
    if (!meta || isLoadingAssets) {
      console.log('Waiting for asset metadata to load...');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const walletAddress = ethereumWallets[0].address as `0x${string}`;
      const checksummedAddress = getAddress(walletAddress);

      // Initialize InfoClient
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });

      // Get user clearinghouse state (positions, balance, margin)
      const clearinghouseState = await infoClient.clearinghouseState({
        user: checksummedAddress,
      });

      // Log raw API response for debugging
      console.log('=== CLEARINGHOUSE STATE API RESPONSE ===');
      console.log('Raw clearinghouseState:', JSON.stringify(clearinghouseState, null, 2));
      console.log('marginSummary:', JSON.stringify(clearinghouseState.marginSummary, null, 2));
      console.log('accountValue:', clearinghouseState.marginSummary?.accountValue);
      console.log('totalNtlPos:', clearinghouseState.marginSummary?.totalNtlPos);
      console.log('withdrawable:', clearinghouseState.withdrawable);
      console.log('Number of positions:', clearinghouseState.assetPositions?.length || 0);

      // Fetch prices (using cached asset metadata)
      const contexts = await fetchPrices();
      if (!contexts) {
        throw new Error('Failed to fetch price data');
      }

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
            if (assetNameFromCoin && meta?.universe) {
              // Find the asset ID by matching the coin name in the universe
              const foundAssetIndex = meta.universe.findIndex((a: any) => a.name === assetNameFromCoin);
              if (foundAssetIndex !== undefined && foundAssetIndex !== -1) {
                finalAssetId = foundAssetIndex;
              }
            }
            
            // Get current price (mark price) for this asset
            let currentPrice: string | null = null;
            if (finalAssetId !== undefined) {
              currentPrice = getPrice(finalAssetId) || contexts[finalAssetId]?.markPx || null;
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
            
            // Handle leverage - can be object with value property or direct value
            const leverageValue = (pos.position.leverage as any)?.value ?? pos.position.leverage;
            const leverageStr = leverageValue ? String(leverageValue) : '1';
            
            // Handle liquidation price - can be object with px property or direct value
            const liquidationPxRaw = pos.position.liquidationPx as any;
            const liquidationPxValue = liquidationPxRaw?.px ?? liquidationPxRaw;
            const liquidationPxStr = liquidationPxValue ? String(liquidationPxValue) : 'N/A';
            
            openPositions.push({
              asset: finalAssetId,
              assetName,
              side: isLong ? 'long' : 'short',
              size: Math.abs(size).toFixed(6),
              entryPx: pos.position.entryPx || '0',
              currentPx: currentPrice,
              fundingRate,
              leverage: leverageStr,
              unrealizedPnl: pos.position.unrealizedPnl || '0',
              liquidationPx: liquidationPxStr,
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
      
      const accountSummaryData = {
        accountValue: marginSummary?.accountValue || '0',
        totalNtlPos: marginSummary?.totalNtlPos || '0',
        unrealizedPnl: totalUnrealizedPnl.toFixed(2),
        withdrawable: clearinghouseState.withdrawable || '0',
        marginUsed: (marginSummary as any)?.marginUsed || '0',
        crossMaintenanceMarginUsed: crossMaintenanceMarginUsed || '0',
        crossMarginRatio,
        crossAccountLeverage,
      };

      console.log('=== ACCOUNT SUMMARY CALCULATED ===');
      console.log('Account Value:', accountSummaryData.accountValue);
      console.log('Total Notional Position:', accountSummaryData.totalNtlPos);
      console.log('Unrealized PnL:', accountSummaryData.unrealizedPnl);
      console.log('Withdrawable:', accountSummaryData.withdrawable);
      console.log('Cross Account Leverage:', accountSummaryData.crossAccountLeverage);
      console.log('Number of open positions:', openPositions.length);
      if (openPositions.length > 0) {
        console.log('Open positions:', openPositions.map(p => ({
          asset: p.assetName,
          size: p.size,
          entryPx: p.entryPx,
          currentPx: p.currentPx,
          unrealizedPnl: p.unrealizedPnl,
        })));
      }

      setAccountSummary(accountSummaryData);
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
  }, [ethereumWallets, meta, isLoadingAssets, isTestnet, assetMap, fetchPrices, getPrice]);

  // Auto-fetch positions when wallet is available or network changes
  useEffect(() => {
    if (authenticated && walletsReady && ethereumWallets.length > 0 && meta && !isLoadingAssets) {
      fetchPositions();
      // Refresh positions every 5 seconds
      const interval = setInterval(fetchPositions, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated, walletsReady, ethereumWallets.length, isTestnet, meta, isLoadingAssets, fetchPositions]);

  return {
    positions,
    accountSummary,
    isLoading,
    error,
    fetchPositions,
    ready: ready && walletsReady,
    authenticated,
    hasWallet: ethereumWallets.length > 0,
  };
}
