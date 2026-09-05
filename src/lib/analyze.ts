import {
  formatEther,
  formatUnits,
  hexToBigInt,
  isAddress,
  isHex,
  type Hex,
} from "viem";

import type {
  DecodedAction,
  Finding,
  ReceiptAnalysis,
  RiskLevel,
} from "./types";

const SELECTORS = {
  approve: "0x095ea7b3",
  transfer: "0xa9059cbb",
  transferFrom: "0x23b872dd",
} as const;

const UNLIMITED = (BigInt(2) ** BigInt(256)) - BigInt(1);
const NEAR_UNLIMITED = UNLIMITED / BigInt(2);

function scoreLevel(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 35) return "watch";
  return "low";
}

function wordToAddress(word: string): `0x${string}` {
  return `0x${word.slice(24)}`;
}

function detectBuilderCode(data: Hex): boolean {
  const lower = data.toLowerCase();
  return lower.includes("8021802180218021") || /8021/.test(lower.slice(-80));
}

function decodeAction(data: Hex): DecodedAction {
  if (data.length < 10) {
    return { kind: "unknown", selector: data.slice(0, 10) || "0x" };
  }

  const selector = data.slice(0, 10).toLowerCase();
  const body = data.slice(10);

  if (selector === SELECTORS.approve && body.length >= 128) {
    const spenderWord = body.slice(0, 64);
    const amountWord = body.slice(64, 128);
    const amount = hexToBigInt(`0x${amountWord}`);
    return {
      kind: "erc20_approve",
      tokenHint: "ERC-20",
      spender: wordToAddress(spenderWord),
      amount: amount.toString(),
      unlimited: amount >= NEAR_UNLIMITED,
    };
  }

  if (selector === SELECTORS.transfer && body.length >= 128) {
    const toWord = body.slice(0, 64);
    const amountWord = body.slice(64, 128);
    return {
      kind: "erc20_transfer",
      tokenHint: "ERC-20",
      to: wordToAddress(toWord),
      amount: hexToBigInt(`0x${amountWord}`).toString(),
    };
  }

  if (selector === SELECTORS.transferFrom && body.length >= 192) {
    const fromWord = body.slice(0, 64);
    const toWord = body.slice(64, 128);
    const amountWord = body.slice(128, 192);
    return {
      kind: "erc20_transfer_from",
      tokenHint: "ERC-20",
      from: wordToAddress(fromWord),
      to: wordToAddress(toWord),
      amount: hexToBigInt(`0x${amountWord}`).toString(),
    };
  }

  return { kind: "unknown", selector: data.slice(0, 10) };
}

function buildFindings(input: {
  action: DecodedAction;
  to?: `0x${string}`;
  valueWei: bigint;
  builderCodePresent: boolean;
  calldata: Hex;
}): Finding[] {
  const findings: Finding[] = [];
  const { action, to, valueWei, builderCodePresent, calldata } = input;

  if (action.kind === "erc20_approve") {
    if (action.unlimited) {
      findings.push({
        id: "unlimited-approval",
        severity: "high",
        title: "Unlimited token approval",
        detail: `Spender ${action.spender} can move your entire ${action.tokenHint} balance until revoked.`,
      });
    } else {
      findings.push({
        id: "bounded-approval",
        severity: "watch",
        title: "Token approval",
        detail: `Approves ${action.amount} base units to ${action.spender}. Confirm the spender is a protocol you trust.`,
      });
    }
  }

  if (action.kind === "erc20_transfer" || action.kind === "erc20_transfer_from") {
    findings.push({
      id: "token-transfer",
      severity: "watch",
      title: "Token transfer",
      detail: `Moves ${action.amount} base units to ${action.to}. Verify the recipient before signing.`,
    });
  }

  if (action.kind === "unknown") {
    findings.push({
      id: "opaque-calldata",
      severity: "watch",
      title: "Unrecognized calldata",
      detail: `Selector ${action.selector} is not in the local decoder. Treat as opaque until verified against the contract ABI.`,
    });
  }

  if (valueWei > BigInt(0)) {
    findings.push({
      id: "native-value",
      severity: valueWei > BigInt(10) ** BigInt(17) ? "high" : "watch",
      title: "Native ETH attached",
      detail: `Transaction sends ${formatEther(valueWei)} ETH with the call.`,
    });
  }

  if (to && !isAddress(to)) {
    findings.push({
      id: "bad-to",
      severity: "high",
      title: "Invalid destination",
      detail: "Destination address failed format checks.",
    });
  }

  if (calldata.length > 10_000) {
    findings.push({
      id: "huge-calldata",
      severity: "watch",
      title: "Very large calldata",
      detail:
        "Oversized payload can hide nested calls. Inspect with a full simulator before signing.",
    });
  }

  if (!builderCodePresent) {
    findings.push({
      id: "no-builder-code",
      severity: "low",
      title: "No Builder Code detected",
      detail:
        "No ERC-8021 / Builder Code marker found in calldata. Attribution rewards may not route to an app.",
    });
  } else {
    findings.push({
      id: "builder-code",
      severity: "low",
      title: "Builder Code marker present",
      detail: "Calldata appears to carry an ERC-8021-style attribution suffix.",
    });
  }

  return findings;
}

function scoreFindings(findings: Finding[]): number {
  return Math.min(
    100,
    findings.reduce((sum, f) => {
      if (f.severity === "high") return sum + 40;
      if (f.severity === "watch") return sum + 18;
      return sum + 4;
    }, 0),
  );
}

function summarize(level: RiskLevel, action: DecodedAction): string {
  if (level === "high") {
    if (action.kind === "erc20_approve" && action.unlimited) {
      return "High risk: unlimited approval can drain the token later.";
    }
    return "High risk: review value transfer and destination carefully before signing.";
  }
  if (level === "watch") {
    return "Watch: action is understandable but needs destination/spender confirmation.";
  }
  return "Low risk heuristics locally — still confirm you initiated this from a trusted app.";
}

export function analyzeCalldata(input: {
  calldata: string;
  to?: string;
  from?: string;
  valueWei?: bigint;
  hash?: `0x${string}`;
  source?: "calldata" | "transaction";
}): ReceiptAnalysis {
  const raw = input.calldata.trim();
  if (!isHex(raw)) {
    throw new Error("Calldata must be a hex string starting with 0x.");
  }

  const calldata = raw.toLowerCase() as Hex;
  const to =
    input.to && isAddress(input.to) ? (input.to as `0x${string}`) : undefined;
  const from =
    input.from && isAddress(input.from)
      ? (input.from as `0x${string}`)
      : undefined;
  const valueWei = input.valueWei ?? BigInt(0);
  const action = decodeAction(calldata);
  const builderCodePresent = detectBuilderCode(calldata);
  const findings = buildFindings({
    action,
    to,
    valueWei,
    builderCodePresent,
    calldata,
  });
  const score = scoreFindings(findings);
  const level = scoreLevel(score);

  return {
    source: input.source ?? "calldata",
    chainId: 8453,
    chainName: "Base",
    hash: input.hash,
    from,
    to,
    valueEth: formatEther(valueWei),
    calldata,
    action,
    findings,
    score,
    level,
    summary: summarize(level, action),
    builderCodePresent,
    analyzedAt: new Date().toISOString(),
  };
}

function padAmountHex(amount: bigint): string {
  return amount.toString(16).padStart(64, "0");
}

export const DEMO_SAMPLES = [
  {
    id: "unlimited-approve",
    label: "Unlimited approve",
    calldata:
      "0x095ea7b3000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeefffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as Hex,
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
  },
  {
    id: "bounded-transfer",
    label: "1.00 token transfer",
    calldata:
      `0xa9059cbb0000000000000000000000001111111111111111111111111111111111111111${padAmountHex(BigInt(1_000_000))}` as Hex,
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
  },
] as const;

export function formatAmountHint(amount: string, decimals = 6): string {
  try {
    return formatUnits(BigInt(amount), decimals);
  } catch {
    return amount;
  }
}

export function shortAddr(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
