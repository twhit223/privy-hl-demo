/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { NetworkProvider, useNetwork } from '@/contexts/NetworkContext';

// Test component that uses the network context
function TestComponent() {
  const { network, isTestnet, setNetwork, toggleNetwork } = useNetwork();

  return (
    <div>
      <div data-testid="network">{network}</div>
      <div data-testid="is-testnet">{isTestnet.toString()}</div>
      <button onClick={() => setNetwork('mainnet')}>Set Mainnet</button>
      <button onClick={() => setNetwork('testnet')}>Set Testnet</button>
      <button onClick={toggleNetwork}>Toggle</button>
    </div>
  );
}

describe('NetworkContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should default to mainnet when env var is not set', () => {
    const originalEnv = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET;
    delete process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET;

    render(
      <NetworkProvider>
        <TestComponent />
      </NetworkProvider>
    );

    expect(screen.getByTestId('network')).toHaveTextContent('mainnet');
    expect(screen.getByTestId('is-testnet')).toHaveTextContent('false');

    // Restore env var
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET = originalEnv;
    }
  });

  it('should default to testnet when env var is set to true', () => {
    const originalEnv = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET;
    process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET = 'true';

    render(
      <NetworkProvider>
        <TestComponent />
      </NetworkProvider>
    );

    expect(screen.getByTestId('network')).toHaveTextContent('testnet');
    expect(screen.getByTestId('is-testnet')).toHaveTextContent('true');

    // Restore env var
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET;
    }
  });

  it('should toggle between testnet and mainnet', () => {
    render(
      <NetworkProvider defaultNetwork="mainnet">
        <TestComponent />
      </NetworkProvider>
    );

    expect(screen.getByTestId('network')).toHaveTextContent('mainnet');

    const toggleButton = screen.getByText('Toggle');
    act(() => {
      toggleButton.click();
    });

    expect(screen.getByTestId('network')).toHaveTextContent('testnet');
    expect(screen.getByTestId('is-testnet')).toHaveTextContent('true');

    act(() => {
      toggleButton.click();
    });

    expect(screen.getByTestId('network')).toHaveTextContent('mainnet');
    expect(screen.getByTestId('is-testnet')).toHaveTextContent('false');
  });

  it('should persist network choice to localStorage', () => {
    render(
      <NetworkProvider defaultNetwork="mainnet">
        <TestComponent />
      </NetworkProvider>
    );

    const toggleButton = screen.getByText('Toggle');
    act(() => {
      toggleButton.click();
    });

    expect(localStorage.getItem('hyperliquid-network')).toBe('testnet');
  });

  it('should load network from localStorage on mount', () => {
    localStorage.setItem('hyperliquid-network', 'testnet');

    render(
      <NetworkProvider defaultNetwork="mainnet">
        <TestComponent />
      </NetworkProvider>
    );

    expect(screen.getByTestId('network')).toHaveTextContent('testnet');
  });
});
