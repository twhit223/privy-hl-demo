# privy-hl-demo

A simple demo app that uses Privy to connect and trade on Hyperliquid

This is a [Next.js](https://nextjs.org) project that demonstrates how to build a decentralized trading application using Privy for wallet management and authentication, integrated with the Hyperliquid DEX for perpetual futures trading.

## Features

### Onboarding Flow

The app provides a complete onboarding experience for users new to Web3:

1. **Authentication** - Users can sign in using:
   - Email
   - Twitter/X
   - External wallet (MetaMask, WalletConnect, etc.)

2. **Wallet Creation** - Privy automatically creates an embedded Ethereum wallet for users who don't have one. The wallet is created on login and supports EIP-155 compatible chains (Ethereum, Arbitrum, etc.).

3. **Hyperliquid Client Initialization** - The app initializes a Hyperliquid exchange client connected to the user's Privy wallet, enabling them to interact with the Hyperliquid protocol.

4. **Funding Options** - Multiple ways to fund the wallet:
   - **Buy USDC** - Purchase USDC directly with Apple Pay/Google Pay via Coinbase CDP integration (requires Privy dashboard configuration)
   - **Deposit** - Bridge USDC from Arbitrum to Hyperliquid using the official Hyperliquid bridge
   - **Testnet Faucet** - Get testnet USDC for testing (testnet mode only)

### Trading Features

Once onboarded and funded, users can:

1. **View Balances** - See their USDC balance on Hyperliquid (both mainnet and testnet)

2. **View Positions** - Display all open positions with:
   - Position size, entry price, and current price
   - Unrealized P&L
   - Leverage and liquidation price
   - Funding rates
   - Account summary (total value, withdrawable balance)

3. **Place Orders** - Trade perpetual futures:
   - **Open Positions** - Open new long or short positions
   - **Close Positions** - Close existing positions
   - Market orders with automatic price calculation
   - Real-time asset price display
   - Order validation and error handling

4. **Trade History** - View past trades with:
   - Trade timestamp, asset, side (buy/sell)
   - Price, size, and total value
   - Closed P&L (when available)
   - Auto-refresh every 30 seconds

5. **Network Toggle** - Switch between Hyperliquid mainnet and testnet environments

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Privy account (sign up at [privy.io](https://privy.io))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/twhit223/privy-hl-demo.git
cd privy-hl-demo
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Required: Privy App ID (get from Privy Dashboard)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here

# Required: Privy App Secret (get from Privy Dashboard, used for API routes)
PRIVY_APP_SECRET=your_privy_app_secret_here

# Optional: Set to 'true' to use Hyperliquid testnet (defaults to mainnet)
NEXT_PUBLIC_HYPERLIQUID_TESTNET=false
```

**Important:** Never commit your `.env.local` file to version control. It's already included in `.gitignore`.

### Privy App Configuration

To enable all features of the app, you need to configure your Privy app in the [Privy Dashboard](https://dashboard.privy.io):

#### 1. Create a Privy App

1. Go to [dashboard.privy.io](https://dashboard.privy.io)
2. Sign in or create an account
3. Click "Create App" or select an existing app
4. Copy your **App ID** and **App Secret** to your `.env.local` file

#### 2. Configure Login Methods

In your Privy app settings, enable the following login methods:
- **Email** - Required for email-based authentication
- **Twitter** - Required for Twitter/X OAuth login
- **Wallet** - Required for external wallet connections (MetaMask, WalletConnect, etc.)

#### 3. Configure Embedded Wallets

Navigate to **"User management" → "Embedded wallets"**:

- Enable **Ethereum** embedded wallets
- Set **Create on login** to `users-without-wallets` (this matches the app configuration)
- This ensures users automatically get a wallet when they sign in

#### 4. Configure Account Funding (Optional - for Buy USDC feature)

To enable the "Buy USDC" feature with Apple Pay/Google Pay:

1. Navigate to **"User management" → "Account funding"**
2. Enable **"Pay with card"**
3. Configure **Coinbase onramp** as your payment provider:
   - Sign up for [Coinbase Developer Platform](https://portal.cdp.coinbase.com)
   - Get your Coinbase CDP API credentials
   - Add them to your Privy dashboard
4. Set your desired network to **Arbitrum** (required for Hyperliquid deposits)
5. Configure recommended amount (minimum $5)
6. Save changes

**Note:** The Buy USDC feature uses Privy's `useFundWallet` hook with Coinbase CDP SDK integration. Users can pay with Apple Pay/Google Pay without signing up for Coinbase.

#### 5. Network Configuration

The app supports both Hyperliquid mainnet and testnet:

- **Mainnet**: Default when `NEXT_PUBLIC_HYPERLIQUID_TESTNET` is not set or `false`
- **Testnet**: Set `NEXT_PUBLIC_HYPERLIQUID_TESTNET=true` in `.env.local`

Users can toggle between networks using the Network Toggle component in the UI.

#### 6. Gas Sponsorship

**Important:** We were not able to get gas sponsorship to work in this app, even with funding configured in the Privy account.

To ensure funds can be deposited to Hyperliquid, users need to have a small amount of ETH in their Arbitrum address to pay for gas fees. This is required for:

- Depositing USDC to Hyperliquid via the bridge
- Executing transactions on Arbitrum

**Recommendation:** When users fund their wallet with USDC (via Buy USDC or other methods), they should also ensure they have a small amount of ETH (approximately 0.001-0.01 ETH) on Arbitrum to cover gas costs. Users can:

1. Buy ETH directly on Arbitrum using a DEX or bridge
2. Bridge ETH from Ethereum mainnet to Arbitrum


Without ETH for gas, deposit transactions to Hyperliquid will fail.

### Running the App

1. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

3. Follow the onboarding flow:
   - Sign in with email, Twitter, or wallet
   - Your embedded wallet will be created automatically
   - Initialize the Hyperliquid client
   - Fund your wallet (Buy USDC, Deposit, or use Testnet Faucet)
   - Start trading!

## Project Structure

```
├── app/
│   ├── api/
│   │   └── hyperliquid/
│   │       └── init/          # API route for Hyperliquid client initialization
│   ├── layout.tsx            # Root layout with PrivyProvider
│   └── page.tsx              # Main page with onboarding and trading sections
├── components/
│   ├── AuthButton.tsx        # Privy authentication button
│   ├── BalanceDisplay.tsx    # Display Hyperliquid USDC balance
│   ├── BuyUSDC.tsx          # Buy USDC with card payment
│   ├── Deposit.tsx           # Bridge USDC from Arbitrum to Hyperliquid
│   ├── HyperliquidClient.tsx # Initialize Hyperliquid exchange client
│   ├── NetworkToggle.tsx     # Toggle between mainnet/testnet
│   ├── PlaceOrder.tsx        # Place orders (open/close positions)
│   ├── PrivyProvider.tsx     # Privy provider configuration
│   ├── TestnetFaucet.tsx     # Get testnet USDC
│   ├── TradeHistory.tsx      # Display trade history
│   ├── TradingSection.tsx    # Trading section wrapper
│   ├── ViewPositions.tsx     # Display open positions
│   └── WalletSetup.tsx       # Wallet creation and display
├── contexts/
│   └── NetworkContext.tsx    # Network state management (mainnet/testnet)
├── hooks/
│   ├── useHyperliquidAssets.ts  # Fetch available trading assets
│   ├── useHyperliquidPrices.ts  # Fetch real-time asset prices
│   └── usePositions.ts           # Fetch user positions and account summary
└── __tests__/               # Jest test files
```

## Technologies Used

- **Next.js 15** - React framework with App Router
- **Privy** - Wallet management and authentication
- **Hyperliquid** - Decentralized perpetual futures exchange
- **Viem** - Ethereum library for wallet interactions
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Styling
- **Jest** - Testing framework

## Testing

Run tests with:
```bash
npm test
# or
yarn test
# or
pnpm test
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Privy Documentation](https://docs.privy.io) - Learn about Privy authentication and wallet management
- [Hyperliquid Documentation](https://hyperliquid.gitbook.io/hyperliquid-docs) - Learn about Hyperliquid protocol
- [Viem Documentation](https://viem.sh) - Learn about Viem Ethereum library

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add your environment variables in Vercel's dashboard
4. Deploy!

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## License

MIT License
