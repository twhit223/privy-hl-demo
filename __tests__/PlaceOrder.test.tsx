/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PlaceOrder } from '@/components/PlaceOrder';
import { NetworkProvider } from '@/contexts/NetworkContext';

// Mock Privy hooks
jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    ready: true,
    authenticated: true,
  }),
  useWallets: () => ({
    wallets: [
      {
        address: '0x1234567890123456789012345678901234567890',
        chainId: 'eip155:42161',
      },
    ],
    ready: true,
  }),
  useSignTypedData: () => ({
    signTypedData: jest.fn().mockResolvedValue({ signature: '0x123' }),
  }),
}));

// Mock viem
jest.mock('viem', () => ({
  getAddress: jest.fn((addr: string) => addr),
}));

// Mock Hyperliquid
const mockAssets = [
  { id: 0, name: 'BTC', szDecimals: 3 },
  { id: 1, name: 'ETH', szDecimals: 3 },
];

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn().mockImplementation(({ isTestnet }) => ({
    isTestnet,
  })),
  InfoClient: jest.fn().mockImplementation(() => ({
    clearinghouseState: jest.fn().mockResolvedValue({
      withdrawable: '1000.00',
      marginSummary: {
        accountValue: '1000.00',
      },
    }),
    metaAndAssetCtxs: jest.fn().mockResolvedValue([
      {
        universe: mockAssets.map((a) => ({ name: a.name, szDecimals: a.szDecimals })),
      },
      [
        { markPx: '50000.00' },
        { markPx: '3000.00' },
      ],
    ]),
  })),
  ExchangeClient: jest.fn().mockImplementation(() => ({
    order: jest.fn().mockResolvedValue({ status: 'ok' }),
  })),
}));

// Mock hooks
jest.mock('@/hooks/useHyperliquidAssets', () => ({
  useHyperliquidAssets: jest.fn((isTestnet: boolean) => ({
    assets: mockAssets,
    getAssetMetadata: (id: number) => mockAssets.find((a) => a.id === id),
    assetMap: { 0: 'BTC', 1: 'ETH' },
    meta: {
      universe: mockAssets.map((a) => ({ name: a.name, szDecimals: a.szDecimals })),
    },
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));

jest.mock('@/hooks/useHyperliquidPrices', () => ({
  useHyperliquidPrices: jest.fn((isTestnet: boolean) => ({
    fetchPrices: jest.fn().mockResolvedValue([
      { markPx: '50000.00' },
      { markPx: '3000.00' },
    ]),
    getPrice: jest.fn((id: number) => {
      if (id === 0) return '50000.00';
      if (id === 1) return '3000.00';
      return null;
    }),
    isLoading: false,
    error: null,
  })),
}));

describe('PlaceOrder - Network Switching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should default to BTC when switching to mainnet', async () => {
    const { rerender } = render(
      <NetworkProvider defaultNetwork="testnet">
        <PlaceOrder mode="open" />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/BTC/i)).toBeInTheDocument();
    });

    // Switch to mainnet
    rerender(
      <NetworkProvider defaultNetwork="mainnet">
        <PlaceOrder mode="open" />
      </NetworkProvider>
    );

    // Should still default to BTC (even though asset ID may differ)
    await waitFor(() => {
      const assetSelect = screen.getByLabelText(/Select Asset/i) as HTMLSelectElement;
      expect(assetSelect.value).toBe('0'); // BTC is at index 0
    });
  });

  it('should reset selected asset when network changes', async () => {
    const { rerender } = render(
      <NetworkProvider defaultNetwork="testnet">
        <PlaceOrder mode="open" />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/BTC/i)).toBeInTheDocument();
    });

    // Change network - this should trigger asset reset
    rerender(
      <NetworkProvider defaultNetwork="mainnet">
        <PlaceOrder mode="open" />
      </NetworkProvider>
    );

    // Asset should be reset to BTC
    await waitFor(() => {
      const assetSelect = screen.getByLabelText(/Select Asset/i) as HTMLSelectElement;
      expect(assetSelect.value).toBe('0');
    });
  });

  it('should use correct network for fetching prices', async () => {
    const { useHyperliquidPrices } = require('@/hooks/useHyperliquidPrices');

    render(
      <NetworkProvider defaultNetwork="mainnet">
        <PlaceOrder mode="open" />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(useHyperliquidPrices).toHaveBeenCalledWith(false); // mainnet = false
    });
  });

  it('should use correct network for fetching assets', async () => {
    const { useHyperliquidAssets } = require('@/hooks/useHyperliquidAssets');

    render(
      <NetworkProvider defaultNetwork="testnet">
        <PlaceOrder mode="open" />
      </NetworkProvider>
    );

    await waitFor(() => {
      expect(useHyperliquidAssets).toHaveBeenCalledWith(true); // testnet = true
    });
  });
});
