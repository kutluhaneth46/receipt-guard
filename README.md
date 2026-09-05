# Receipt Guard

See the Base call before you sign.

Paste a Base transaction hash or raw calldata. Receipt Guard decodes common ERC-20 approvals/transfers, scores local risk heuristics, flags Builder Code markers, and gives you a shareable receipt card.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- viem for hex/address helpers and Base RPC reads

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4311](http://127.0.0.1:4311).

Optional env:

```bash
BASE_RPC_URL=https://mainnet.base.org
```

## What it does today

- Decode `approve` / `transfer` / `transferFrom`
- Flag unlimited approvals and native ETH value
- Detect ERC-8021-style Builder Code markers in calldata
- Demo buttons for instant walkthrough
- Copy-to-clipboard share receipt text

## Not yet

- Full ABI simulation / tenderly traces
- SIWE saved history
- Production Builder Code registration flow on base.dev

Built as a Base builder surface for attribution-ready apps.
