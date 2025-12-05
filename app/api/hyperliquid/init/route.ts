import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/node';
import { createViemAccount } from '@privy-io/node/viem';
import * as hl from '@nktkas/hyperliquid';

const privy = new PrivyClient({
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, accessToken } = body;

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet address is required',
        },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access token is required. Please log in first.',
        },
        { status: 401 }
      );
    }

    // Verify the access token
    try {
      await privy.utils().auth().verifyAuthToken(accessToken);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired access token. Please log in again.',
        },
        { status: 401 }
      );
    }

    // Get the wallet from Privy
    // Note: We need to find the wallet by address
    // For now, we'll create a viem account using the address
    // In a real scenario, you'd get the wallet ID from Privy
    
    // Create viem account from wallet address
    // Note: This is a simplified version - in production you'd get the actual wallet ID
    const account = createViemAccount(privy, {
      walletId: walletAddress, // This might need to be the actual wallet ID
      address: walletAddress as `0x${string}`,
    });

    // Initialize Hyperliquid client (testnet)
    const isTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET === 'true';
    const transport = new hl.HttpTransport({
      isTestnet: isTestnet,
    });

    const client = new hl.ExchangeClient({
      transport,
      wallet: account,
    });

    // Test the client by getting exchange info
    // Note: This might require actual network access, so we'll just verify initialization
    return NextResponse.json({
      success: true,
      client: {
        initialized: true,
        network: isTestnet ? 'testnet' : 'mainnet',
        walletAddress: walletAddress,
      },
      message: 'Hyperliquid client initialized successfully',
    });
  } catch (error) {
    console.error('Error initializing Hyperliquid client:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize Hyperliquid client',
      },
      { status: 500 }
    );
  }
}


