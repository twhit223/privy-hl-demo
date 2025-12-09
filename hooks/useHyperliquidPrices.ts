'use client';

import { useState, useEffect, useCallback } from 'react';
import * as hl from '@nktkas/hyperliquid';
import { throttleRequest } from '@/utils/apiThrottle';

interface AssetContext {
  markPx?: string;
  [key: string]: any;
}

interface PriceData {
  contexts: AssetContext[];
  lastFetched: number;
}

// Cache for price data (shorter cache since prices change frequently)
const priceCache: Map<string, PriceData> = new Map();
const PRICE_CACHE_DURATION = 10 * 1000; // 10 seconds cache for prices (increased from 5s)

export function useHyperliquidPrices(isTestnet: boolean = false) {
  const cacheKey = isTestnet ? 'testnet' : 'mainnet';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async (forceRefresh: boolean = false): Promise<AssetContext[] | null> => {
    const cached = priceCache.get(cacheKey);
    const isCacheValid = cached && (Date.now() - cached.lastFetched) < PRICE_CACHE_DURATION;

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid && cached) {
      return cached.contexts;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use throttling to prevent rate limiting
      const contexts = await throttleRequest(
        `prices-${cacheKey}`,
        async () => {
          const transport = new hl.HttpTransport({ isTestnet });
          const infoClient = new hl.InfoClient({ transport });
          
          // Fetch only contexts (prices) - we already have metadata cached
          const [, contexts] = await infoClient.metaAndAssetCtxs();
          return contexts;
        },
        2000 // Minimum 2 seconds between price requests
      );
      
      const priceData: PriceData = {
        contexts,
        lastFetched: Date.now(),
      };

      priceCache.set(cacheKey, priceData);
      setIsLoading(false);
      
      return contexts;
    } catch (err) {
      console.error('Error fetching prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      setIsLoading(false);
      
      // Return cached data even if stale if available
      if (cached) {
        return cached.contexts;
      }
      
      return null;
    }
  }, [cacheKey, isTestnet]);

  const getPrice = useCallback((assetId: number): string | null => {
    const cached = priceCache.get(cacheKey);
    if (cached && cached.contexts[assetId]?.markPx) {
      return cached.contexts[assetId].markPx;
    }
    return null;
  }, [cacheKey]);

  return {
    fetchPrices,
    getPrice,
    isLoading,
    error,
  };
}

