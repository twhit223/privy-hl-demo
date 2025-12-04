import { NextRequest, NextResponse } from 'next/server';

// Note: This API route is kept for backward compatibility.
// Privy automatically creates embedded wallets for authenticated users.
// The WalletSetup component uses useWallets() hook to access user wallets directly.
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: 'Please use Privy authentication. Wallets are automatically created when you log in.',
      message: 'Use the useWallets() hook in your React components to access your embedded wallets.',
    },
    { status: 400 }
  );
}

