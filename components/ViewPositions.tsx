'use client';

import { usePositions, type Position, type AccountSummary } from '@/hooks/usePositions';

export function ViewPositions() {
  const { positions, accountSummary, isLoading, error, fetchPositions, ready, authenticated, hasWallet } = usePositions();

  if (!ready) {
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
          Please log in to view positions.
        </p>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No Ethereum wallet found.
        </p>
      </div>
    );
  }

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPnl = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num >= 0 ? `+${formatted}` : formatted;
  };

  return (
    <div className="p-6 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Open Positions</h2>
        <button
          onClick={fetchPositions}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Account Summary */}
      {accountSummary && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Account Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Account Value</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                ${formatCurrency(accountSummary.accountValue)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Total Position Value</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                ${formatCurrency(accountSummary.totalNtlPos)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Unrealized PnL</p>
              <p className={`text-lg font-semibold ${
                parseFloat(accountSummary.unrealizedPnl) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatPnl(accountSummary.unrealizedPnl)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Withdrawable</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                ${formatCurrency(accountSummary.withdrawable)} USDC
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading && positions.length === 0 && !error && (
        <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
          Loading positions...
        </div>
      )}

      {!isLoading && positions.length === 0 && !error && (
        <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
          No open positions found.
        </div>
      )}

      {positions.length > 0 && (
        <div className="space-y-3">
          {positions.map((position, index) => {
            const pnl = parseFloat(position.unrealizedPnl);
            const isProfit = pnl >= 0;
            
            return (
              <div
                key={`${position.asset}-${index}`}
                className="p-4 bg-white dark:bg-zinc-800 border rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {position.assetName}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          position.side === 'long'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {position.side.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Asset ID: {position.asset}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        isProfit
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatPnl(position.unrealizedPnl)} USDC
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Unrealized PnL</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Size</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatNumber(position.size)} {position.assetName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Entry Price</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      ${formatNumber(position.entryPx)}
                    </p>
                    {position.currentPx && (
                      <>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 mt-1">Current Price</p>
                        <p className={`text-sm font-medium ${
                          parseFloat(position.currentPx) > parseFloat(position.entryPx)
                            ? 'text-green-600 dark:text-green-400'
                            : parseFloat(position.currentPx) < parseFloat(position.entryPx)
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}>
                          ${formatNumber(position.currentPx)}
                        </p>
                      </>
                    )}
                    {position.fundingRate !== null && (
                      <>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 mt-1">Funding Rate</p>
                        <p className={`text-sm font-medium ${
                          parseFloat(position.fundingRate) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {parseFloat(position.fundingRate) >= 0 ? '+' : ''}{position.fundingRate}%
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Leverage</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatNumber(position.leverage)}x
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Liquidation Price</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {position.liquidationPx === 'N/A' ? 'N/A' : `$${formatNumber(position.liquidationPx)}`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> Positions auto-refresh every 5 seconds. Click "Refresh" to update manually.
        </p>
      </div>
    </div>
  );
}

