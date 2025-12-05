'use client';

import { usePrivy, useWallets, useSignTypedData } from '@privy-io/react-auth';
import { useState, useMemo, useEffect } from 'react';
import { getAddress } from 'viem';
import * as hl from '@nktkas/hyperliquid';
import type { AbstractViemLocalAccount } from '@nktkas/hyperliquid/signing';

interface Position {
  asset: number;
  assetName: string;
  side: 'long' | 'short';
  size: string;
  entryPx: string;
}

interface PlaceOrderProps {
  mode?: 'open' | 'close';
}

export function PlaceOrder(props?: PlaceOrderProps) {
  const mode = props?.mode ?? 'open';
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTypedData: privySignTypedData } = useSignTypedData();
  
  // Form state - Asset selection
  const [availableAssets, setAvailableAssets] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [selectedAssetName, setSelectedAssetName] = useState<string>('');
  const isTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET === 'true';
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [inputMode, setInputMode] = useState<'asset' | 'usd'>('usd');
  const [size, setSize] = useState<string>('');
  const [usdValue, setUsdValue] = useState<string>('1500');
  const [assetPrice, setAssetPrice] = useState<number | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [szDecimals, setSzDecimals] = useState<number | null>(null);
  const [tickSize, setTickSize] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);
  
  // Position closing state
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [selectedPositionAssetId, setSelectedPositionAssetId] = useState<number | null>(null);
  const [selectedPositionAssetPrice, setSelectedPositionAssetPrice] = useState<number | null>(null);
  const [selectedPositionAssetSzDecimals, setSelectedPositionAssetSzDecimals] = useState<number | null>(null);
  const [selectedPositionAssetTickSize, setSelectedPositionAssetTickSize] = useState<number | null>(null);

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

  // Fetch available assets
  const fetchAvailableAssets = async () => {
    if (ethereumWallets.length === 0) return;

    try {
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });
      const [meta] = await infoClient.metaAndAssetCtxs();
      
      const assets = meta.universe.map((asset, index) => ({
        id: index,
        name: asset.name || `Asset ${index}`,
      }));
      
      setAvailableAssets(assets);
      
      // Set default to BTC if available, otherwise first asset
      const btcIndex = assets.findIndex((a) => a.name === 'BTC');
      if (btcIndex !== -1) {
        setSelectedAssetId(btcIndex);
        setSelectedAssetName('BTC');
      } else if (assets.length > 0) {
        setSelectedAssetId(0);
        setSelectedAssetName(assets[0].name);
      }
    } catch (err) {
      console.error('Error fetching available assets:', err);
    }
  };

  // Fetch selected asset price and available balance
  const fetchMarketData = async () => {
    if (ethereumWallets.length === 0 || selectedAssetId === null) return;

    setIsLoadingPrice(true);
    try {
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });

      // Get current asset price (mark price) using metaAndAssetCtxs
      // Reference: https://docs.privy.io/recipes/hyperliquid/trading-patterns#always-validate-prices
      const [meta, contexts] = await infoClient.metaAndAssetCtxs();
      
      const asset = meta.universe[selectedAssetId];
      if (asset) {
        console.log('=== FETCHING MARKET DATA ===');
        console.log('Asset:', asset.name, 'Index:', selectedAssetId);
        console.log('Asset metadata:', JSON.stringify(asset, null, 2));
        
        // Extract szDecimals for size validation
        if (asset.szDecimals !== undefined && asset.szDecimals !== null) {
          console.log('✓ szDecimals found:', asset.szDecimals);
          setSzDecimals(asset.szDecimals);
        } else {
          console.error('✗ szDecimals not found in asset metadata', JSON.stringify(asset, null, 2));
        }
        
        // Calculate tick size from price precision rules
        // According to Privy docs: tick size = 10^(-maxPriceDecimals)
        // For perps: MAX_DECIMALS = 6, so maxPriceDecimals = 6 - szDecimals
        const maxPriceDecimals = 6 - (asset.szDecimals || 5);
        const calculatedTickSize = Math.pow(10, -maxPriceDecimals);
        console.log('✓ tickSize calculated:', calculatedTickSize, '(from maxPriceDecimals:', maxPriceDecimals, ', szDecimals:', asset.szDecimals, ')');
        console.log('✓ Tick size decimal places:', maxPriceDecimals);
        setTickSize(calculatedTickSize);
        
        if (contexts[selectedAssetId]) {
          const assetContext = contexts[selectedAssetId];
          if (assetContext.markPx) {
            setAssetPrice(parseFloat(assetContext.markPx));
          }
        }
      } else {
        console.error('✗ Asset not found in universe');
      }

      // Get available balance
      const walletAddress = ethereumWallets[0].address as `0x${string}`;
      const checksummedAddress = getAddress(walletAddress);
      const clearinghouseState = await infoClient.clearinghouseState({
        user: checksummedAddress,
      });
      
      // Get account value (available for trading)
      const accountValue = clearinghouseState.marginSummary?.accountValue;
      if (accountValue) {
        setAvailableBalance(parseFloat(accountValue));
      } else {
        // Fallback to withdrawable if accountValue not available
        const withdrawable = clearinghouseState.withdrawable;
        if (withdrawable) {
          setAvailableBalance(parseFloat(withdrawable));
        }
      }
    } catch (err) {
      console.error('Error fetching market data:', err);
      // Don't set error state, just log it
    } finally {
      setIsLoadingPrice(false);
    }
  };

  // Fetch positions for closing mode
  const fetchPositions = async () => {
    if (ethereumWallets.length === 0 || mode !== 'close') return;

    setIsLoadingPrice(true);
    try {
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });
      const walletAddress = ethereumWallets[0].address as `0x${string}`;
      const checksummedAddress = getAddress(walletAddress);

      const clearinghouseState = await infoClient.clearinghouseState({
        user: checksummedAddress,
      });

      const [meta, contexts] = await infoClient.metaAndAssetCtxs();
      const assetMap: Record<number, string> = {};
      meta.universe?.forEach((asset, index) => {
        assetMap[index] = asset.name || `Asset ${index}`;
      });

      const openPositions: Position[] = [];
      if (clearinghouseState.assetPositions) {
        clearinghouseState.assetPositions.forEach((pos) => {
          const size = parseFloat(pos.position.szi || '0');
          if (Math.abs(size) > 0) {
            const assetNameFromCoin = pos.position.coin;
            const assetId = (pos.position as any).asset || 0;
            const assetNameFromMap = assetMap[assetId] || `Asset ${assetId}`;
            const assetName = assetNameFromCoin || assetNameFromMap;
            const isLong = parseFloat(pos.position.szi || '0') > 0;
            
            let finalAssetId = assetId;
            if (assetNameFromCoin) {
              const foundAssetIndex = meta.universe?.findIndex((a) => a.name === assetNameFromCoin);
              if (foundAssetIndex !== undefined && foundAssetIndex !== -1) {
                finalAssetId = foundAssetIndex;
              }
            }
            
            openPositions.push({
              asset: finalAssetId,
              assetName,
              side: isLong ? 'long' : 'short',
              size: Math.abs(size).toString(),
              entryPx: pos.position.entryPx || '0',
            });
          }
        });
      }

      setPositions(openPositions);
    } catch (err) {
      console.error('Error fetching positions:', err);
      if (err instanceof Error && (err.message.includes('does not exist') || err.message.includes('not found'))) {
        setPositions([]);
      }
    } finally {
      setIsLoadingPrice(false);
    }
  };

  // Fetch market data for selected position when closing
  const fetchPositionMarketData = async (position: Position) => {
    if (ethereumWallets.length === 0) return;

    setIsLoadingPrice(true);
    try {
      const transport = new hl.HttpTransport({ isTestnet });
      const infoClient = new hl.InfoClient({ transport });
      const [meta, contexts] = await infoClient.metaAndAssetCtxs();
      
      const asset = meta.universe[position.asset];
      if (asset) {
        setSelectedPositionAssetId(position.asset);
        
        if (asset.szDecimals !== undefined && asset.szDecimals !== null) {
          setSelectedPositionAssetSzDecimals(asset.szDecimals);
        }
        
        const maxPriceDecimals = 6 - (asset.szDecimals || 5);
        const calculatedTickSize = Math.pow(10, -maxPriceDecimals);
        setSelectedPositionAssetTickSize(calculatedTickSize);
        
        if (contexts[position.asset]?.markPx) {
          setSelectedPositionAssetPrice(parseFloat(contexts[position.asset].markPx));
        }
      }
    } catch (err) {
      console.error('Error fetching position market data:', err);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  // Auto-fetch available assets when wallet is available
  useEffect(() => {
    if (authenticated && walletsReady && ethereumWallets.length > 0 && mode === 'open') {
      fetchAvailableAssets();
    }
  }, [authenticated, walletsReady, ethereumWallets.length, mode]);

  // Auto-fetch market data when selected asset changes
  useEffect(() => {
    if (authenticated && walletsReady && ethereumWallets.length > 0 && selectedAssetId !== null && mode === 'open') {
      fetchMarketData();
      // Refresh price every 10 seconds
      const interval = setInterval(fetchMarketData, 10000);
      return () => clearInterval(interval);
    }
  }, [authenticated, walletsReady, ethereumWallets.length, selectedAssetId, mode]);

  // Auto-fetch positions when wallet is available (for close mode)
  useEffect(() => {
    if (authenticated && walletsReady && ethereumWallets.length > 0 && mode === 'close') {
      fetchPositions();
      // Refresh positions every 5 seconds
      const interval = setInterval(fetchPositions, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated, walletsReady, ethereumWallets.length, mode]);

  // When position is selected, fetch its market data and set size
  useEffect(() => {
    if (selectedPosition && mode === 'close') {
      fetchPositionMarketData(selectedPosition);
      setSize(selectedPosition.size);
      // Set side to opposite of position
      setSide(selectedPosition.side === 'long' ? 'sell' : 'buy');
    }
  }, [selectedPosition, mode]);

  // Round size to szDecimals precision
  // According to Privy docs: sizes must be rounded to szDecimals
  // If szDecimals = 3, then 1.001 is valid but 1.0001 is not
  // Note: We keep trailing zeros as Hyperliquid expects exact precision
  const roundSize = (sizeValue: string): string => {
    if (!sizeValue || szDecimals === null || szDecimals === undefined) {
      return sizeValue;
    }
    const num = parseFloat(sizeValue);
    if (isNaN(num)) return sizeValue;
    // Round to szDecimals precision and return as string
    return num.toFixed(szDecimals);
  };

  // Calculate asset size from USD value
  const calculateAssetSize = (usd: string): string => {
    if (!assetPrice || !usd) return '';
    const usdNum = parseFloat(usd);
    if (isNaN(usdNum) || usdNum <= 0) return '';
    const calculatedSize = (usdNum / assetPrice).toString();
    // Round to szDecimals if available, otherwise use 8 decimals as fallback
    return szDecimals !== null ? roundSize(calculatedSize) : calculatedSize;
  };

  // Calculate leverage needed
  const calculateLeverage = (): number | null => {
    if (!availableBalance) return null;
    if (inputMode === 'usd' && usdValue) {
      const usdNum = parseFloat(usdValue);
      if (isNaN(usdNum) || usdNum <= 0) return null;
      return usdNum / availableBalance;
    } else if (inputMode === 'asset' && size && assetPrice) {
      const assetNum = parseFloat(size);
      if (isNaN(assetNum) || assetNum <= 0) return null;
      const usdValue = assetNum * assetPrice;
      return usdValue / availableBalance;
    }
    return null;
  };

  const placeOrder = async () => {
    // Determine size and asset based on mode
    let orderSize: string;
    let orderAssetId: number | null;
    let orderAssetPrice: number | null;
    let orderAssetSzDecimals: number | null;
    let orderAssetTickSize: number | null;
    let orderAssetName: string;
    const isReduceOnly = mode === 'close';

    if (mode === 'close') {
      // Closing mode: use selected position
      if (!selectedPosition) {
        setOrderResult({
          success: false,
          message: 'Please select a position to close.',
        });
        return;
      }
      
      if (!size) {
        setOrderResult({
          success: false,
          message: 'Please enter a size to close.',
        });
        return;
      }

      const closeSizeNum = parseFloat(size);
      const positionSizeNum = parseFloat(selectedPosition.size);
      
      if (isNaN(closeSizeNum) || closeSizeNum <= 0) {
        setOrderResult({
          success: false,
          message: 'Please enter a valid size greater than 0.',
        });
        return;
      }

      if (closeSizeNum > positionSizeNum) {
        setOrderResult({
          success: false,
          message: `Cannot close more than position size (${selectedPosition.size}).`,
        });
        return;
      }

      orderSize = size;
      orderAssetId = selectedPositionAssetId;
      orderAssetPrice = selectedPositionAssetPrice;
      orderAssetSzDecimals = selectedPositionAssetSzDecimals;
      orderAssetTickSize = selectedPositionAssetTickSize;
      orderAssetName = selectedPosition.assetName;
    } else {
      // Opening mode: use selected asset
      if (selectedAssetId === null) {
        setOrderResult({
          success: false,
          message: 'Please select an asset to trade.',
        });
        return;
      }

      if (inputMode === 'usd') {
        if (!usdValue || assetPrice === null) {
          setOrderResult({
            success: false,
            message: 'Please enter a USD value and ensure asset price is loaded.',
          });
          return;
        }
        orderSize = calculateAssetSize(usdValue);
        if (!orderSize || parseFloat(orderSize) <= 0) {
          setOrderResult({
            success: false,
            message: 'Invalid USD value. Please enter a positive number.',
          });
          return;
        }
      } else {
        if (!size) {
          setOrderResult({
            success: false,
            message: `Please enter a ${selectedAssetName} size.`,
          });
          return;
        }
        orderSize = size;
      }

      orderAssetId = selectedAssetId;
      orderAssetPrice = assetPrice; // Use state variable
      orderAssetSzDecimals = szDecimals;
      orderAssetTickSize = tickSize;
      orderAssetName = selectedAssetName;
    }

    if (ethereumWallets.length === 0) {
      setOrderResult({
        success: false,
        message: 'Please ensure you have a wallet.',
      });
      return;
    }

    // Validate that market data is available
    if (orderAssetSzDecimals === null || orderAssetId === null || orderAssetPrice === null || orderAssetTickSize === null) {
      setOrderResult({
        success: false,
        message: 'Market data not loaded. Please wait for price data to load.',
      });
      return;
    }

    // Round the size to the correct precision before placing order
    // According to Privy docs, size must be rounded to szDecimals precision
    const sizeNum = parseFloat(orderSize);
    if (isNaN(sizeNum) || sizeNum <= 0) {
      setOrderResult({
        success: false,
        message: 'Invalid order size. Please enter a positive number.',
      });
      return;
    }
    
    // Round to szDecimals precision and keep as string
    // According to Privy docs: "When implementing signing, trailing zeroes should be removed from prices and sizes"
    let finalSize = sizeNum.toFixed(orderAssetSzDecimals);
    // Remove trailing zeros (e.g., "0.00100" -> "0.001", "1.00000" -> "1")
    finalSize = finalSize.replace(/\.?0+$/, '');
    // If we removed all decimals, ensure we have at least the integer part
    if (finalSize === '' || finalSize === '.') {
      finalSize = sizeNum.toFixed(0);
    }
    console.log('Order size - Original:', orderSize);
    console.log('Order size - Numeric:', sizeNum);
    console.log('Order size - szDecimals:', orderAssetSzDecimals);
    console.log('Order size - Final (after removing trailing zeros):', finalSize);
    console.log('Order size - Final type:', typeof finalSize);

    setIsSubmitting(true);
    setOrderResult(null);

    try {
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
      // According to Privy docs: For market orders, use a price close to current market
      // - For buys: Set limit price ≥ current best ask (use 1% above mark price)
      // - For sells: Set limit price ≤ current best bid (use 1% below mark price)
      // This ensures immediate execution while staying within the 80% price deviation limit
      // For closing positions, use the same price calculation logic (not 999999/0)
      
      // Calculate market price: 1% above for buys, 1% below for sells
      const priceMultiplier = side === 'buy' ? 1.01 : 0.99;
      let calculatedPrice = orderAssetPrice * priceMultiplier;
      
      // Round price to nearest tick size (required by Hyperliquid)
      let roundedPrice = Math.round(calculatedPrice / orderAssetTickSize) * orderAssetTickSize;
      
      // Ensure we don't exceed 5 significant figures (Privy docs requirement)
      const priceStr = Math.abs(roundedPrice).toString();
      const significantFigures = priceStr.replace(/\.|0+$/g, '').replace(/^0+/, '').length;
      
      if (significantFigures > 5) {
        // Round to 5 significant figures
        const magnitude = Math.floor(Math.log10(Math.abs(roundedPrice)));
        const factor = Math.pow(10, magnitude - 4); // Keep 5 significant figures
        roundedPrice = Math.round(roundedPrice / factor) * factor;
        // Re-round to tick size after adjusting significant figures
        roundedPrice = Math.round(roundedPrice / orderAssetTickSize) * orderAssetTickSize;
      }
      
      // Format price: calculate max decimal places (6 - szDecimals for perps)
      const maxPriceDecimals = 6 - orderAssetSzDecimals;
      
      // Calculate the number of decimal places needed for the tick size
      const tickSizeDecimals = orderAssetTickSize < 1 ? Math.abs(Math.log10(orderAssetTickSize)) : 0;
      const requiredDecimals = Math.min(maxPriceDecimals, tickSizeDecimals);
      
      // Format with the required decimal precision (don't remove trailing zeros for prices)
      // Hyperliquid needs exact decimal precision to validate tick size
      let marketPrice = roundedPrice.toFixed(requiredDecimals);
      
      // Verify the price is divisible by tick size
      const priceNum = parseFloat(marketPrice);
      const remainder = (priceNum / orderAssetTickSize) % 1;
      if (Math.abs(remainder) > 0.0000001 && Math.abs(remainder - 1) > 0.0000001) {
        // If not divisible, round again
        roundedPrice = Math.round(priceNum / orderAssetTickSize) * orderAssetTickSize;
        marketPrice = roundedPrice.toFixed(requiredDecimals);
      }
      
      console.log('Price calculation:', {
        originalPrice: orderAssetPrice,
        multiplier: priceMultiplier,
        calculatedPrice,
        tickSize: orderAssetTickSize,
        tickSizeDecimals,
        requiredDecimals,
        roundedPrice,
        significantFigures,
        maxPriceDecimals,
        finalPrice: marketPrice,
        priceDivisible: (parseFloat(marketPrice) / orderAssetTickSize) % 1 === 0
      });
      
      console.log('=== PLACING ORDER ===');
      console.log('Mode:', mode);
      console.log('Asset ID:', orderAssetId);
      console.log('Asset Name:', orderAssetName);
      console.log('Side:', side === 'buy' ? 'buy' : 'sell');
      console.log('Size (string):', finalSize);
      console.log('Size type:', typeof finalSize);
      console.log('szDecimals:', orderAssetSzDecimals);
      console.log('Price:', marketPrice);
      console.log('Reduce-only:', isReduceOnly);
      
      const result = await client.order({
        orders: [
          {
            a: orderAssetId,
            b: side === 'buy', // true for long/buy, false for short/sell
            p: marketPrice, // Market price (IOC will fill at best available price)
            s: finalSize, // Size as string, rounded to szDecimals precision
            r: isReduceOnly, // Reduce-only flag: true for closing, false for opening
            t: {
              limit: {
                tif: 'Ioc', // Immediate Or Cancel - market order behavior
              },
            },
          },
        ],
        grouping: 'na', // Standard order grouping
      });

      const orderValue = mode === 'close' 
        ? (parseFloat(finalSize) * (orderAssetPrice || 0)).toFixed(2)
        : (inputMode === 'usd' ? usdValue : (parseFloat(finalSize) * (orderAssetPrice || 0)).toFixed(2));
      
      // Debug: Log order response to verify what was actually ordered
      console.log('=== ORDER RESPONSE ===');
      console.log('Order result:', JSON.stringify(result, null, 2));
      console.log('Asset ID used in order:', orderAssetId);
      console.log('Expected asset name:', orderAssetName);
      
      const actionText = mode === 'close' 
        ? `Position closed successfully! Closed ${finalSize} ${orderAssetName}`
        : `Order placed successfully! ${side === 'buy' ? 'Buying' : 'Selling'} ${finalSize} ${orderAssetName} (~$${orderValue})`;
      
      setOrderResult({
        success: true,
        message: actionText,
        data: result,
      });
      
      // Refresh positions if closing
      if (mode === 'close') {
        setTimeout(() => {
          fetchPositions();
          setSelectedPosition(null);
          setSize('');
        }, 2000);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      
      // Check for specific Hyperliquid errors
      let errorMessage = 'Failed to place order';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check if wallet doesn't exist (needs funding first)
        if (error.message.includes('does not exist') || error.message.includes('not registered')) {
          errorMessage = 'Your wallet is not registered on Hyperliquid. You have USDC on Arbitrum, but you need to deposit it to Hyperliquid first using the "Deposit" step above. This will activate your Hyperliquid account.';
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

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  return (
    <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold mb-4">
        {mode === 'close' ? 'Close Position' : 'Step 5: Place Market Order'}
      </h2>
      
      <div className="space-y-4">
        {/* Network Indicator */}
        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Network:
            </span>
            <span className="px-2 py-1 text-xs font-semibold bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded">
              {isTestnet ? 'TESTNET' : 'MAINNET'}
            </span>
          </div>
        </div>

        {mode === 'close' ? (
          <>
            {positions.length === 0 && !isLoadingPrice && (
              <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
                No open positions to close.
              </div>
            )}
            
            {positions.length > 0 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Select Position to Close
                  </label>
                  <select
                    value={selectedPosition ? `${selectedPosition.asset}-${selectedPosition.side}` : ''}
                    onChange={(e) => {
                      const [assetId, side] = e.target.value.split('-');
                      const pos = positions.find(
                        (p) => p.asset.toString() === assetId && p.side === side
                      );
                      setSelectedPosition(pos || null);
                    }}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">-- Select a position --</option>
                    {positions.map((position, index) => (
                      <option
                        key={`${position.asset}-${position.side}-${index}`}
                        value={`${position.asset}-${position.side}`}
                      >
                        {position.assetName} - {position.side.toUpperCase()} - Size: {formatNumber(position.size)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPosition && (
                  <div className="p-4 bg-white dark:bg-zinc-800 border rounded-lg">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                      Position Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Asset</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {selectedPosition.assetName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Side</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {selectedPosition.side.toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Current Size</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatNumber(selectedPosition.size)} {selectedPosition.assetName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Entry Price</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          ${formatNumber(selectedPosition.entryPx)}
                        </p>
                      </div>
                    </div>
                    {selectedPositionAssetPrice && (
                      <div className="mb-4">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Current Price</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          ${formatNumber(selectedPositionAssetPrice)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Asset Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Select Asset <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedAssetId !== null ? selectedAssetId : ''}
                onChange={(e) => {
                  const assetId = parseInt(e.target.value);
                  const asset = availableAssets.find((a) => a.id === assetId);
                  if (asset) {
                    setSelectedAssetId(assetId);
                    setSelectedAssetName(asset.name);
                    // Reset size and price when asset changes
                    setSize('');
                    setAssetPrice(null);
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                disabled={availableAssets.length === 0}
              >
                <option value="">-- Select an asset --</option>
                {availableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Asset Display */}
            {selectedAssetId !== null && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Asset: {selectedAssetName}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Asset ID: {selectedAssetId} • Market Order (IOC)
                    </p>
                  </div>
                  <div className="text-right">
                    {assetPrice && (
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        ${assetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                    {availableBalance !== null && (
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Available: ${availableBalance.toFixed(2)} USDC
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

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
                  Input Mode
                </label>
                <select
                  value={inputMode}
                  onChange={(e) => setInputMode(e.target.value as 'asset' | 'usd')}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="usd">USD Value</option>
                  <option value="asset">{selectedAssetName || 'Asset'} Size</option>
                </select>
              </div>
            </div>
          </>
        )}

        {mode === 'close' ? (
          selectedPosition && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Size to Close <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder={selectedPosition.size}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-2"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Enter the amount to close (max: {formatNumber(selectedPosition.size)})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSize(selectedPosition.size)}
                  className="px-3 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Use Full Size
                </button>
                <button
                  onClick={() => setSize((parseFloat(selectedPosition.size) / 2).toString())}
                  className="px-3 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Use Half Size
                </button>
              </div>
            </div>
          )
        ) : (
          inputMode === 'usd' ? (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                USD Value <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={usdValue}
                onChange={(e) => setUsdValue(e.target.value)}
                placeholder="1500"
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
              <div className="mt-2 space-y-1">
                {assetPrice && usdValue && selectedAssetName && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    ≈ {calculateAssetSize(usdValue)} {selectedAssetName}
                  </p>
                )}
                {calculateLeverage() !== null && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Leverage: {calculateLeverage()!.toFixed(2)}x
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Size ({selectedAssetName || 'Asset'}) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="0.1"
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
              <div className="mt-2 space-y-1">
                {assetPrice && size && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    ≈ ${(parseFloat(size) * assetPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </p>
                )}
                {calculateLeverage() !== null && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Leverage: {calculateLeverage()!.toFixed(2)}x
                  </p>
                )}
              </div>
            </div>
          )
        )}

        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>{mode === 'close' ? 'Market Close Order' : 'Market Order'}:</strong> This order will execute immediately at the best available market price. 
            {mode === 'close' ? ' The order is reduce-only, meaning it will only close your existing position.' : ' Any unfilled portion will be canceled (IOC - Immediate Or Cancel).'}
          </p>
        </div>

        <button
          onClick={placeOrder}
          disabled={
            isSubmitting || 
            isLoadingPrice || 
            (mode === 'close' 
              ? (!selectedPosition || !size)
              : (selectedAssetId === null || (inputMode === 'usd' ? !usdValue : !size)))
          }
          className={`w-full px-4 py-2 rounded-lg transition-colors ${
            mode === 'close'
              ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed'
          }`}
        >
          {isSubmitting 
            ? (mode === 'close' ? 'Closing Position...' : 'Placing Market Order...')
            : isLoadingPrice 
            ? 'Loading Market Data...' 
            : (mode === 'close' ? 'Close Position' : 'Place Market Order')
          }
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
            {!orderResult.success && (orderResult.message.includes('does not exist') || orderResult.message.includes('not registered')) && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  <strong>Important:</strong> You have USDC on Arbitrum (on-chain), but you need to deposit it to Hyperliquid first.
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Next Step:</strong> Go to the "Step 4: Deposit to HyperCore" section above and send your USDC to the bridge address. 
                  This will activate your Hyperliquid account and make your funds available for trading.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

