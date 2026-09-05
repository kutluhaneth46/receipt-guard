export type RiskLevel = "low" | "watch" | "high";

export type Finding = {
  id: string;
  severity: RiskLevel;
  title: string;
  detail: string;
};

export type DecodedAction =
  | {
      kind: "erc20_approve";
      tokenHint: string;
      spender: `0x${string}`;
      amount: string;
      unlimited: boolean;
    }
  | {
      kind: "erc20_transfer";
      tokenHint: string;
      to: `0x${string}`;
      amount: string;
    }
  | {
      kind: "erc20_transfer_from";
      tokenHint: string;
      from: `0x${string}`;
      to: `0x${string}`;
      amount: string;
    }
  | {
      kind: "unknown";
      selector: string;
    };

export type ReceiptAnalysis = {
  source: "calldata" | "transaction";
  chainId: number;
  chainName: string;
  hash?: `0x${string}`;
  from?: `0x${string}`;
  to?: `0x${string}`;
  valueEth: string;
  calldata: `0x${string}`;
  action: DecodedAction;
  findings: Finding[];
  score: number;
  level: RiskLevel;
  summary: string;
  builderCodePresent: boolean;
  analyzedAt: string;
};
