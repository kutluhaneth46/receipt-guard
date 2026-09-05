import { createPublicClient, http, isHex, type Hex } from "viem";
import { base } from "viem/chains";
import { NextResponse } from "next/server";

import { analyzeCalldata } from "@/lib/analyze";

export const runtime = "nodejs";

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      hash?: string;
      calldata?: string;
      to?: string;
      from?: string;
      valueWei?: string;
    };

    if (body.hash) {
      if (!isHex(body.hash) || body.hash.length !== 66) {
        return NextResponse.json(
          { error: "Transaction hash must be 0x + 64 hex chars." },
          { status: 400 },
        );
      }

      const tx = await client.getTransaction({ hash: body.hash as Hex });
      if (!tx) {
        return NextResponse.json(
          { error: "Transaction not found on Base." },
          { status: 404 },
        );
      }

      const analysis = analyzeCalldata({
        calldata: (tx.input || "0x") as Hex,
        to: tx.to || undefined,
        from: tx.from,
        valueWei: tx.value,
        hash: body.hash as Hex,
        source: "transaction",
      });

      return NextResponse.json({ analysis });
    }

    if (!body.calldata) {
      return NextResponse.json(
        { error: "Provide a Base tx hash or calldata." },
        { status: 400 },
      );
    }

    const analysis = analyzeCalldata({
      calldata: body.calldata,
      to: body.to,
      from: body.from,
      valueWei: body.valueWei ? BigInt(body.valueWei) : BigInt(0),
      source: "calldata",
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze input.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
