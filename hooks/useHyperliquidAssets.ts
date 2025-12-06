'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as hl from '@nktkas/hyperliquid';

interface AssetMetadata {
  id: number;
  name: string;
  szDecimals?: number;
}

interface CachedAssetData {
  meta: any;
  assetMap: Record<number, string>;
  assets: AssetMetadata[];
  lastFetched: number;
}

// Global cache for asset metadata (doesn't change frequently)
const assetMetadataCache: Map<string, CachedAssetData> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export function useHyperliquidAssets(isTestnet: boolean = false) {
  const cacheKey = isTestnet ? 'testnet' : 'mainnet';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0); // Track cache updates

  // Check if we have valid cached data
  const cachedData = useMemo(() => assetMetadataCache.get(cacheKey), [cacheKey, cacheVersion]);
  const isCacheValid = useMemo(() => {
    return cachedData && (Date.now() - cachedData.lastFetched) < CACHE_DURATION;
  }, [cachedData]);

  const fetchAssetMetadata = useCallback(async (forceRefresh: boolean = false): Promise<CachedAssetData | null> => {
    // Return cached data if valid and not forcing refresh
    const currentCached = assetMetadataCache.get(cacheKey);
    if (!forceRefresh && currentCached && (Date.now() - currentCached.lastFetched) < CACHE_DURATION) {
      return currentCached;
    }

    setIsLoading(true);
    setError(null);

    try {
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });
      
      // Fetch metadata (we only need meta, not contexts for asset map)
      const [meta] = await infoClient.metaAndAssetCtxs();
      
      // Build asset map and assets array
      const assetMap: Record<number, string> = {};
      const assets: AssetMetadata[] = [];
      
      meta.universe?.forEach((asset: any, index: number) => {
        const assetName = asset.name || `Asset ${index}`;
        assetMap[index] = assetName;
        assets.push({
          id: index,
          name: assetName,
          szDecimals: asset.szDecimals,
        });
      });

      const newCachedData: CachedAssetData = {
        meta,
        assetMap,
        assets,
        lastFetched: Date.now(),
      };

      // Update cache
      assetMetadataCache.set(cacheKey, newCachedData);
      
      // Trigger re-render by updating cache version (only if component is still mounted)
      setCacheVersion(prev => prev + 1);
      setIsLoading(false);
      return newCachedData;
    } catch (err) {
      console.error('Error fetching asset metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch asset metadata');
      setIsLoading(false);
      
      // Return cached data even if stale if available
      if (currentCached) {
        return currentCached;
      }
      
      return null;
    }
  }, [isTestnet, cacheKey]);

  // Auto-fetch on mount if cache is invalid
  useEffect(() => {
    let isMounted = true;
    
    if (!isCacheValid) {
      fetchAssetMetadata().catch((err) => {
        if (isMounted) {
          console.error('Error in fetchAssetMetadata:', err);
        }
      });
    }
    
    return () => {
      isMounted = false;
    };
  }, [cacheKey, isCacheValid, fetchAssetMetadata]);

  return {
    assetMap: cachedData?.assetMap || {},
    assets: cachedData?.assets || [],
    meta: cachedData?.meta,
    isLoading,
    error,
    refresh: () => fetchAssetMetadata(true),
    getAssetMetadata: (assetId: number): AssetMetadata | undefined => {
      return cachedData?.assets.find(a => a.id === assetId);
    },
  };
}

