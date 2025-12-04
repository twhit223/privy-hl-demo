'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';

export function AuthButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  if (!ready) {
    return (
      <div className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Please log in to create and manage your wallets.
        </p>
        <button
          onClick={login}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Log In
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Logged in as
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {user?.email?.address || user?.twitter?.username || 'User'}
            </p>
          </div>
          <button
            onClick={logout}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
      {wallets.length > 0 && (
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          {wallets.length} embedded wallet{wallets.length !== 1 ? 's' : ''} available
        </div>
      )}
    </div>
  );
}

