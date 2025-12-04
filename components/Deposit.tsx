'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useMemo } from 'react';
import { useSendTransaction } from '@privy-io/react-auth';
import { getAddress } from 'viem';

export function Deposit() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { sendTransaction } = useSendTransaction();
  
  // Hyperliquid bridge addresses
  // Mainnet: 0x0000000000000000000000000000000000000000 (placeholder - need actual address)
  // Testnet: 0x0000000000000000000000000000000000000000 (placeholder - need actual address)
  const isTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET === 'true';
  
  // Bridge addresses for Hyperliquid (from official docs)
  // Mainnet Arbitrum bridge address
  const BRIDGE_ADDRESS_MAINNET = '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7';
  // Testnet Arbitrum bridge address
  const BRIDGE_ADDRESS_TESTNET = '0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89';
  
  // USDC contract addresses on Arbitrum
  const USDC_MAINNET = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // Arbitrum USDC (checksummed)
  // For testnet, you may need to get testnet USDC from a faucet
  // Using mainnet USDC address as fallback - users should verify the correct testnet token
  const USDC_TESTNET = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // Using mainnet address - update if testnet has different token
  
  // Ensure addresses are properly checksummed
  const bridgeAddress = isTestnet 
    ? getAddress(BRIDGE_ADDRESS_TESTNET)
    : getAddress(BRIDGE_ADDRESS_MAINNET);
  const usdcAddress = isTestnet 
    ? getAddress(USDC_TESTNET)
    : getAddress(USDC_MAINNET);
  
  const [amount, setAmount] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [txResult, setTxResult] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
  } | null>(null);

  // Get Ethereum embedded wallets
  const ethereumWallets = useMemo(() => {
    return wallets.filter(
      (wallet) => {
        const chainId = wallet.chainId;
        return chainId === 'eip155:1' || 
               chainId === 'eip155:42161' || // Arbitrum
               chainId?.startsWith('eip155:');
      }
    );
  }, [wallets]);

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) < 5) {
      setTxResult({
        success: false,
        message: 'Minimum deposit is 5 USDC',
      });
      return;
    }

    if (ethereumWallets.length === 0) {
      setTxResult({
        success: false,
        message: 'No Ethereum wallet found',
      });
      return;
    }

    setIsSending(true);
    setTxResult(null);

    try {
      // Convert amount to USDC units (6 decimals for USDC)
      const amountInUnits = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
      
      // ERC-20 transfer function signature: transfer(address,uint256)
      const transferFunctionSignature = '0xa9059cbb';
      
      // Encode the function call
      // transfer(address to, uint256 amount)
      // Pad bridge address to 32 bytes (remove 0x, pad to 64 chars)
      const paddedAddress = bridgeAddress.slice(2).padStart(64, '0');
      // Pad amount to 32 bytes (64 hex chars)
      const paddedAmount = amountInUnits.toString(16).padStart(64, '0');
      
      const data = transferFunctionSignature + paddedAddress + paddedAmount;

      // Send transaction
      const tx = await sendTransaction({
        to: usdcAddress as `0x${string}`,
        value: '0x0', // No ETH value, this is an ERC-20 transfer
        data: data as `0x${string}`,
      });

      setTxResult({
        success: true,
        message: 'Transaction sent successfully!',
        txHash: tx.hash,
      });
    } catch (error) {
      console.error('Error sending deposit transaction:', error);
      setTxResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send transaction',
      });
    } finally {
      setIsSending(false);
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
          Please log in to deposit funds.
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

  const explorerUrl = isTestnet 
    ? `https://sepolia.arbiscan.io/tx/`
    : `https://arbiscan.io/tx/`;

  return (
    <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold mb-4">Step 4: Deposit to HyperCore (Initialize Account)</h2>
      
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            <strong>Important:</strong> To trade on Hyperliquid, you need to deposit USDC first.
            This will activate your account on Hyperliquid.
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Minimum deposit: 5 USDC • Network: {isTestnet ? 'Arbitrum Sepolia (Testnet)' : 'Arbitrum (Mainnet)'}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
            <strong>Recommended:</strong> Use the Hyperliquid UI to deposit (go to app.hyperliquid.xyz → Deposit).
            The bridge address below is for programmatic deposits.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Bridge Address (HyperCore)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={bridgeAddress}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
              />
              <button
                onClick={() => navigator.clipboard.writeText(bridgeAddress)}
                className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-sm"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Send USDC to this address on Arbitrum {isTestnet ? 'Sepolia' : ''}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              USDC Contract Address
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={usdcAddress}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
              />
              <button
                onClick={() => navigator.clipboard.writeText(usdcAddress)}
                className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-sm"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              USDC token contract on Arbitrum {isTestnet ? 'Sepolia' : ''}
              {isTestnet && (
                <span className="block mt-1 text-yellow-600 dark:text-yellow-400">
                  Note: For testnet, you may need to get testnet USDC from a faucet or use a different testnet token.
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Deposit Amount (USDC) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
              min="5"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Minimum: 5 USDC
            </p>
          </div>
        </div>

        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> You can either use the button below to send via Privy, or manually send USDC 
            from your wallet to the bridge address using a wallet interface like MetaMask.
          </p>
        </div>

        <button
          onClick={handleDeposit}
          disabled={isSending || !amount || parseFloat(amount) < 5}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSending ? 'Sending Transaction...' : 'Send USDC to Bridge'}
        </button>

        {txResult && (
          <div
            className={`p-4 rounded-lg border ${
              txResult.success
                ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                : 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
            }`}
          >
            <p
              className={`font-semibold mb-2 ${
                txResult.success
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}
            >
              {txResult.success ? '✓ Transaction Sent' : '✗ Transaction Failed'}
            </p>
            <p
              className={`text-sm ${
                txResult.success
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {txResult.message}
            </p>
            {txResult.success && txResult.txHash && (
              <div className="mt-3">
                <a
                  href={`${explorerUrl}${txResult.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View on {isTestnet ? 'Arbiscan Sepolia' : 'Arbiscan'} →
                </a>
              </div>
            )}
          </div>
        )}

        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Manual Deposit Instructions:
          </p>
          <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
            <li>Ensure you have USDC on Arbitrum {isTestnet ? 'Sepolia' : ''} network</li>
            <li>Open your wallet (MetaMask, etc.) and switch to Arbitrum {isTestnet ? 'Sepolia' : ''}</li>
            <li>Send USDC to the bridge address shown above</li>
            <li>Wait for the transaction to confirm (usually 1-2 minutes)</li>
            <li>Your account will be activated on Hyperliquid once the deposit is processed</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

