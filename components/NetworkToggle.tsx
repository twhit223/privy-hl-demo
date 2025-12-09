'use client';

import { useNetwork } from '@/contexts/NetworkContext';

export function NetworkToggle() {
  const { network, toggleNetwork, isTestnet } = useNetwork();

  return (
    <div className="flex items-center gap-3 p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Network:
      </span>
      <button
        onClick={toggleNetwork}
        className={`
          relative inline-flex h-8 w-16 items-center rounded-full transition-colors
          ${isTestnet 
            ? 'bg-blue-600 dark:bg-blue-500' 
            : 'bg-green-600 dark:bg-green-500'
          }
        `}
        aria-label={`Switch to ${isTestnet ? 'mainnet' : 'testnet'}`}
      >
        <span
          className={`
            inline-block h-6 w-6 transform rounded-full bg-white transition-transform
            ${isTestnet ? 'translate-x-1' : 'translate-x-9'}
          `}
        />
      </button>
      <span
        className={`
          px-3 py-1 text-xs font-semibold rounded
          ${isTestnet
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
          }
        `}
      >
        {network.toUpperCase()}
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-auto">
        {isTestnet ? 'Testnet' : 'Mainnet'} mode
      </span>
    </div>
  );
}
