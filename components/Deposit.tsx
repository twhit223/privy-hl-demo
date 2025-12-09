'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useMemo } from 'react';
import { useSendTransaction } from '@privy-io/react-auth';
import { getAddress, encodeFunctionData, parseUnits, createPublicClient, http, formatUnits, erc20Abi } from 'viem';
import { arbitrum } from 'viem/chains';

// Arbitrum mainnet chain ID
const ARBITRUM_CHAIN_ID = 42161;

// Create public client for Arbitrum
const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

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
  const [isSponsored, setIsSponsored] = useState(false); // Toggle for gas sponsorship
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
      const primaryWallet = ethereumWallets[0];
      const walletAddress = getAddress(primaryWallet.address);
      
      // First, verify the wallet has sufficient USDC balance
      console.log('Verifying USDC balance for wallet:', walletAddress);
      try {
        const balance = await arbitrumClient.readContract({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [walletAddress],
        });
        
        const balanceFormatted = formatUnits(balance as bigint, 6);
        console.log('Wallet USDC balance:', balanceFormatted, 'USDC');
        
        if (parseFloat(balanceFormatted) < parseFloat(amount)) {
          setTxResult({
            success: false,
            message: `Insufficient USDC balance. You have ${balanceFormatted} USDC, but trying to send ${amount} USDC.`,
          });
          setIsSending(false);
          return;
        }
      } catch (balanceError) {
        console.error('Error checking balance:', balanceError);
        // Continue anyway - might be a network issue
      }
      
      // Switch wallet to Arbitrum if not already on it
      // This ensures the transaction is sent on Arbitrum network
      const currentChainId = primaryWallet.chainId;
      const arbitrumChainId = `eip155:${ARBITRUM_CHAIN_ID}`;
      
      if (currentChainId !== arbitrumChainId) {
        try {
          await primaryWallet.switchChain(ARBITRUM_CHAIN_ID);
        } catch (switchError) {
          console.error('Error switching chain:', switchError);
          // Continue anyway - the chainId in the transaction should handle it
        }
      }

      // Convert amount to USDC units (6 decimals for USDC)
      // Use parseUnits for proper decimal handling
      const amountInUnits = parseUnits(amount, 6);
      
      // Use viem's encodeFunctionData with erc20Abi (as per Privy guide)
      // This ensures correct ABI encoding matching the official Privy example
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [bridgeAddress, amountInUnits],
      });

      // Log transaction details for debugging
      console.log('Transaction details:', {
        to: usdcAddress,
        bridgeAddress,
        amount: amount,
        amountInUnits: amountInUnits.toString(),
        data,
        chainId: ARBITRUM_CHAIN_ID,
      });
      console.log('Full transaction object:', JSON.stringify({
        to: usdcAddress,
        value: '0x0',
        data: data,
        chainId: ARBITRUM_CHAIN_ID,
      }, null, 2));

      // Send transaction on Arbitrum mainnet
      // Following Privy guide format: https://docs.privy.io/recipes/hyperliquid-guide
      // Note: React hook uses chainId (not caip2 like Node SDK), but structure is similar
      const tx = await sendTransaction(
        {
          to: usdcAddress as `0x${string}`,
          value: '0x0', // No ETH value, this is an ERC-20 transfer
          data: data as `0x${string}`,
          chainId: ARBITRUM_CHAIN_ID, // Arbitrum mainnet chain ID (42161)
        },
        {
          sponsor: isSponsored, // Use toggle state for gas sponsorship
        }
      );

      setTxResult({
        success: true,
        message: 'Transaction sent successfully!',
        txHash: tx.hash,
      });
    } catch (error) {
      console.error('Error sending deposit transaction:', error);
      
      // Log full error details for debugging - including the full error object
      try {
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('Could not stringify error, logging properties:', error);
      }
      
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Try to access any additional properties
        const errorAny = error as any;
        if (errorAny.cause) {
          console.error('Error cause:', errorAny.cause);
        }
        if (errorAny.details) {
          console.error('Error details:', errorAny.details);
        }
        if (errorAny.data) {
          console.error('Error data:', errorAny.data);
        }
        if (errorAny.response) {
          console.error('Error response:', errorAny.response);
        }
        if (errorAny.code) {
          console.error('Error code:', errorAny.code);
        }
        if (errorAny.shortMessage) {
          console.error('Error shortMessage:', errorAny.shortMessage);
        }
      }
      
      // Log the error as-is to see its structure
      console.error('Raw error:', error);
      
      // Try to extract more details from the error object
      let errorMessage = 'Failed to send transaction';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for common error patterns
        if (error.message.includes('UserOperation reverted')) {
          errorMessage = 'Transaction simulation failed. This may be due to insufficient balance, contract restrictions, or invalid transaction data.';
        } else if (error.message.includes('revert') || error.message.includes('Reverted')) {
          errorMessage = 'Transaction was reverted. Please check your USDC balance and ensure the bridge address is correct.';
        } else if (error.message.includes('sponsor') || error.message.includes('gas')) {
          errorMessage = 'Gas sponsorship error. Please verify gas sponsorship is enabled in your Privy dashboard.';
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
          errorMessage = 'Invalid request to Privy. Please check the transaction parameters.';
        }
      }
      
      setTxResult({
        success: false,
        message: errorMessage,
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
      <h2 className="text-xl font-semibold mb-4">Step 6: Deposit to HyperCore (Initialize Account)</h2>
      
      <div className="space-y-4">
        {/* Network Verification */}
        <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200 font-semibold mb-1">
            ✓ Configured for Mainnet
          </p>
          <p className="text-xs text-green-700 dark:text-green-300">
            Network: Arbitrum Mainnet • Hyperliquid: Mainnet
          </p>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            <strong>Important:</strong> To trade on Hyperliquid, you need to deposit USDC first.
            This will activate your account on Hyperliquid mainnet.
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Minimum deposit: 5 USDC • Network: {isTestnet ? 'Arbitrum Sepolia (Testnet)' : 'Arbitrum (Mainnet)'}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
            <strong>Network:</strong> Transaction will be sent on Arbitrum mainnet (chain ID: 42161).
            The wallet will automatically switch to Arbitrum if needed.
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 font-medium">
            <strong>Gas Sponsorship:</strong> {isSponsored 
              ? 'Enabled - Privy app will pay gas fees using preloaded $10 balance.'
              : 'Disabled - You will need ETH in your wallet to pay for gas fees. Make sure you have sufficient ETH balance on Arbitrum to cover the transaction.'}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Bridge Address (HyperCore) - Mainnet
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
              Send USDC to this address on Arbitrum Mainnet
              {isTestnet && <span className="text-red-600 dark:text-red-400 ml-2">⚠️ WARNING: Currently set to testnet!</span>}
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

          <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Gas Sponsorship
              </label>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {isSponsored 
                  ? 'Privy app will pay gas fees (sponsored)'
                  : 'You will pay gas fees from your Arbitrum wallet (unsponsored)'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSponsored(!isSponsored)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isSponsored ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
              role="switch"
              aria-checked={isSponsored}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isSponsored ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
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

      </div>
    </div>
  );
}

