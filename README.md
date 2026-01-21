# Fast Protocol App

The official web application for [Fast Protocol](https://fastprotocol.xyz) - a coordinated rewards layer providing lightning-fast transactions on Ethereum L1 with tokenized MEV rewards.

## Overview

Fast Protocol App is the primary interface for users to interact with Fast Protocol. Users can claim their Genesis SBT (Soul Bound Token) badges, track their rewards and activity, participate in quests, and climb the leaderboard.

### Key Features

- **Genesis SBT Minting** - Claim non-transferable Soul Bound Token badges that represent your participation in the Fast Protocol ecosystem
- **Dashboard** - Track your swap volume, points, and rewards in real-time
- **Leaderboard** - Compete with other users across Gold, Silver, and Bronze tiers based on trading volume
- **Referral System** - Earn rewards by inviting others to join Fast Protocol
- **Partner Quests** - Complete tasks and quests from ecosystem partners
- **Fast RPC Integration** - One-click setup to add Fast Protocol's RPC to MetaMask or Rabby wallet

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Web3**: wagmi, viem, RainbowKit
- **Smart Contracts**: Solidity with Foundry
- **State Management**: TanStack Query

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/primev/fastprotocolapp.git
cd fastprotocolapp

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `EMAILOCTOPUS_API_KEY` | API key for EmailOctopus waitlist integration |
| `EMAILOCTOPUS_LIST_ID` | EmailOctopus mailing list ID |
| `FAST_RPC_API_TOKEN` | Bearer token for Fast RPC readonly database |

## Smart Contracts

The app interacts with the Genesis SBT contract - a UUPS upgradeable Soul Bound Token implementation. See [`contracts/CONTRACT_SUMMARY.md`](contracts/CONTRACT_SUMMARY.md) for details.

Key contract features:
- Non-transferable ERC721 tokens
- On-chain metadata with IPFS image storage
- Public minting with configurable price
- Admin batch minting capabilities

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests
npm run format       # Format code with Prettier
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── (app)/        # Main app routes
│   ├── api/          # API routes
│   └── claim/        # SBT claiming flow
├── components/       # React components
│   ├── dashboard/    # Dashboard-specific components
│   ├── onboarding/   # Onboarding flow components
│   └── ui/           # shadcn/ui components
├── hooks/            # Custom React hooks
├── lib/              # Utilities and configurations
└── actions/          # Server actions
contracts/            # Solidity smart contracts (Foundry)
```

## Links

- **Website**: [fastprotocol.xyz](https://fastprotocol.xyz)
- **OpenSea**: [Fast Protocol Genesis SBT](https://opensea.io/collection/fast-protocol-genesis-sbt)
- **Discord**: [discord.com/invite/fastprotocol](https://discord.com/invite/fastprotocol)
- **Telegram**: [t.me/Fast_Protocol](https://t.me/Fast_Protocol)
- **X (Twitter)**: [@Fast_Protocol](https://x.com/Fast_Protocol)

## License

This project is licensed under the Business Source License 1.1. See [LICENSE](LICENSE) for details.

---

Built by [Primev](https://primev.xyz)
