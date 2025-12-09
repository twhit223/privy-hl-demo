/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BalanceDisplay } from '@/components/BalanceDisplay';
import * as hl from '@nktkas/hyperliquid';

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
}));

// Mock viem
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn().mockResolvedValue(BigInt('1000000000')), // 1000 USDC (6 decimals)
    getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH (18 decimals)
  })),
  http: jest.fn(),
  formatUnits: jest.fn((value: bigint, decimals: number) => {
    if (decimals === 6) return '1000.0'; // USDC
    if (decimals === 18) return '1.0'; // ETH
    return '0';
  }),
  getAddress: jest.fn((addr: string) => addr),
  arbitrum: {},
}));

// Mock Hyperliquid
jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn().mockImplementation(({ isTestnet }) => ({
    isTestnet,
  })),
  InfoClient: jest.fn().mockImplementation(({ transport }) => ({
    clearinghouseState: jest.fn().mockResolvedValue({
      withdrawable: '500.00',
      marginSummary: {
        accountValue: '1000.00',
      },
    }),
  })),
}));

describe('BalanceDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch balances from both testnet and mainnet', async () => {
    render(<BalanceDisplay />);

    // Wait for balances to load
    await waitFor(() => {
      expect(screen.getByText(/Hyperliquid Mainnet USDC/i)).toBeInTheDocument();
      expect(screen.getByText(/Hyperliquid Testnet USDC/i)).toBeInTheDocument();
    });

    // Verify both networks were queried
    expect(hl.HttpTransport).toHaveBeenCalledWith({ isTestnet: false });
    expect(hl.HttpTransport).toHaveBeenCalledWith({ isTestnet: true });
  });

  it('should display Arbitrum balances', async () => {
    render(<BalanceDisplay />);

    await waitFor(() => {
      expect(screen.getByText(/Arbitrum Mainnet USDC/i)).toBeInTheDocument();
      expect(screen.getByText(/Arbitrum ETH/i)).toBeInTheDocument();
    });
  });

  it('should handle errors gracefully when fetching balances', async () => {
    const mockInfoClient = {
      clearinghouseState: jest.fn().mockRejectedValue(new Error('User does not exist')),
    };

    (hl.InfoClient as jest.Mock).mockImplementation(() => mockInfoClient);

    render(<BalanceDisplay />);

    // Should still render the component even if some balances fail
    await waitFor(() => {
      expect(screen.getByText(/Balances/i)).toBeInTheDocument();
    });
  });

  it('should refresh balances when refresh button is clicked', async () => {
    const { rerender } = render(<BalanceDisplay />);

    await waitFor(() => {
      expect(screen.getByText(/Refresh/i)).toBeInTheDocument();
    });

    const refreshButton = screen.getByText(/Refresh/i);
    const initialCallCount = (hl.InfoClient as jest.Mock).mock.calls.length;

    refreshButton.click();

    await waitFor(() => {
      // Should have made additional calls
      expect((hl.InfoClient as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
