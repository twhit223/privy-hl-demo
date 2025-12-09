'use client';

import { NetworkProvider } from '@/contexts/NetworkContext';
import { NetworkToggle } from '@/components/NetworkToggle';
import { BalanceDisplay } from './BalanceDisplay';
import { ViewPositions } from './ViewPositions';
import { PlaceOrder } from './PlaceOrder';
import { TradeHistory } from './TradeHistory';

export function TradingSection() {
  return (
    <NetworkProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-300 dark:border-zinc-700">
          <h2 className="text-2xl font-bold">Trading</h2>
          <NetworkToggle />
        </div>
        
        <BalanceDisplay />
        
        <ViewPositions />
        
        <PlaceOrder mode="close" />
        
        <PlaceOrder mode="open" />
        
        <TradeHistory />
      </div>
    </NetworkProvider>
  );
}
