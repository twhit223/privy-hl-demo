'use client';

import { useState, useEffect, useCallback } from 'react';
import * as hl from '@nktkas/hyperliquid';

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
const PRICE_CACHE_DURATION = 5 * 1000; // 5 seconds cache for prices

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
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });
      
      // Fetch only contexts (prices) - we already have metadata cached
      const [, contexts] = await infoClient.metaAndAssetCtxs();
      
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
  }, [cacheKey]);

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

