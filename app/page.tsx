import { WalletSetup } from '@/components/WalletSetup';
import { AuthButton } from '@/components/AuthButton';
import { HyperliquidClient } from '@/components/HyperliquidClient';
import { BuyUSDC } from '@/components/BuyUSDC';
import { Deposit } from '@/components/Deposit';
import { TestnetFaucet } from '@/components/TestnetFaucet';
import { TradingSection } from '@/components/TradingSection';

export default function Home() {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const isTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET === 'true';

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left w-full">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Hyperliquid Privy Quickstart
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Onboard & Trade on Hyperliquid with a Privy Wallet
          </p>
          
          <div className="mt-8 w-full space-y-8">
            {/* Onboarding Section */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-zinc-300 dark:border-zinc-700">
                Onboarding
              </h2>
              
              <div className="p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
                <h3 className="text-xl font-semibold mb-4">Step 1: Setup Verification</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Privy App ID:</span>
                    <span className={privyAppId ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {privyAppId ? "✓ Configured" : "✗ Missing"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Network:</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {isTestnet ? "Testnet" : "Mainnet"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Environment:</span>
                    <span className="text-green-600 dark:text-green-400">✓ Development</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
                <h3 className="text-xl font-semibold mb-4">Step 2: Authentication</h3>
                <AuthButton />
              </div>
              
              <WalletSetup />
              
              <HyperliquidClient />
              
              <BuyUSDC />
              
              <Deposit />
              
              <TestnetFaucet />
            </div>

            {/* Trading Section */}
            <TradingSection />
          </div>
        </div>
      </main>
    </div>
  );
}
