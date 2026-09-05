# Receipt Guard

**See the Base call before you sign.**

Paste a Base transaction hash or raw calldata. Receipt Guard decodes common ERC-20 approvals and transfers, scores local risk heuristics, detects Builder Code markers, and gives you a shareable receipt card.

Built for the Base builder stack (wagmi/viem era, Builder Codes, pre-sign clarity).

## Live idea

- Decode `approve` / `transfer` / `transferFrom`
- Flag unlimited approvals and native ETH value
- Detect ERC-8021-style Builder Code markers
- Demo buttons + copy-to-clipboard share receipt

## Run locally

```bash
npm install
npm run build
npm run start
```

Dev:

```bash
npm run dev
```

App defaults to [http://127.0.0.1:4311](http://127.0.0.1:4311).

Optional:

```bash
BASE_RPC_URL=https://mainnet.base.org
```

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- viem for hex helpers and Base RPC reads

## Not a full audit

Local heuristics only. Always verify the dapp origin and use a simulator for production-critical flows.

## Repo

https://github.com/kutluhaneth46/receipt-guard
