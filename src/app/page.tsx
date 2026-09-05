"use client";

import { useMemo, useState } from "react";

import {
  DEMO_SAMPLES,
  formatAmountHint,
  shortAddr,
} from "@/lib/analyze";
import type { ReceiptAnalysis, RiskLevel } from "@/lib/types";

const levelStyles: Record<
  RiskLevel,
  { label: string; chip: string; bar: string }
> = {
  low: {
    label: "Low",
    chip: "border-mint/40 bg-mint/20 text-mint",
    bar: "bg-mint",
  },
  watch: {
    label: "Watch",
    chip: "border-amber/40 bg-amber/20 text-amber",
    bar: "bg-amber",
  },
  high: {
    label: "High",
    chip: "border-danger/40 bg-danger/20 text-danger",
    bar: "bg-danger",
  },
};

function actionTitle(analysis: ReceiptAnalysis): string {
  const a = analysis.action;
  if (a.kind === "erc20_approve") {
    return a.unlimited ? "Unlimited ERC-20 approval" : "ERC-20 approval";
  }
  if (a.kind === "erc20_transfer") return "ERC-20 transfer";
  if (a.kind === "erc20_transfer_from") return "ERC-20 transferFrom";
  return `Unknown call (${a.selector})`;
}

function actionLines(analysis: ReceiptAnalysis): string[] {
  const a = analysis.action;
  if (a.kind === "erc20_approve") {
    return [
      `Spender ${shortAddr(a.spender)}`,
      a.unlimited
        ? "Amount unlimited"
        : `Amount ≈ ${formatAmountHint(a.amount)} (6dp hint)`,
    ];
  }
  if (a.kind === "erc20_transfer") {
    return [
      `To ${shortAddr(a.to)}`,
      `Amount ≈ ${formatAmountHint(a.amount)} (6dp hint)`,
    ];
  }
  if (a.kind === "erc20_transfer_from") {
    return [
      `From ${shortAddr(a.from)} → ${shortAddr(a.to)}`,
      `Amount ≈ ${formatAmountHint(a.amount)} (6dp hint)`,
    ];
  }
  return ["No local ABI match — inspect manually."];
}

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [copied, setCopied] = useState(false);

  const shareText = useMemo(() => {
    if (!analysis) return "";
    return [
      `Receipt Guard · ${analysis.chainName}`,
      `${levelStyles[analysis.level].label} risk · score ${analysis.score}/100`,
      actionTitle(analysis),
      analysis.summary,
      analysis.hash ? `tx ${analysis.hash}` : "calldata inspection",
    ].join("\n");
  }, [analysis]);

  async function runAnalyze(payload: {
    hash?: string;
    calldata?: string;
    to?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        analysis?: ReceiptAnalysis;
        error?: string;
      };
      if (!res.ok || !data.analysis) {
        throw new Error(data.error || "Analyze failed");
      }
      setAnalysis(data.analysis);
    } catch (err) {
      setAnalysis(null);
      setError(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value) {
      setError("Paste a Base tx hash or calldata.");
      return;
    }
    if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
      void runAnalyze({ hash: value });
      return;
    }
    void runAnalyze({ calldata: value });
  }

  async function copyShare() {
    if (!shareText) return;
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-16 pt-8 sm:px-8">
      <header className="rise mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="score-pulse flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-paper">
            <span className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight">
              RG
            </span>
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Receipt Guard
            </p>
            <p className="text-sm text-ink-soft/80">Base pre-sign clarity</p>
          </div>
        </div>
        <a
          href="https://www.base.org"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1.5 text-xs font-semibold text-ink-soft backdrop-blur transition hover:border-mint/40 hover:text-mint-deep"
        >
          Built for Base
        </a>
      </header>

      <section className="rise grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-mint-deep">
            See the call before you sign
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Receipt Guard
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Paste a Base transaction hash or raw calldata. We decode approvals
            and transfers, score local risk heuristics, and give you a shareable
            receipt card — including Builder Code detection.
          </p>
        </div>

        <div className="rise-delay rounded-[1.5rem] border border-[var(--line)] bg-white/60 p-4 shadow-[0_20px_60px_rgba(16,42,50,0.08)] backdrop-blur">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft/70">
            Try a demo
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  setInput(sample.calldata);
                  void runAnalyze({ calldata: sample.calldata, to: sample.to });
                }}
                className="rounded-full border border-[var(--line)] bg-paper px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-mint/40 hover:bg-mint/10"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rise-delay mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <form
          onSubmit={onSubmit}
          className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-5 shadow-[0_18px_50px_rgba(16,42,50,0.07)] backdrop-blur sm:p-6"
        >
          <label className="mb-2 block text-sm font-bold text-ink">
            Base tx hash or calldata
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0x… transaction hash or 0x095ea7b3…"
            rows={7}
            className="w-full resize-y rounded-2xl border border-[var(--line)] bg-paper/80 px-4 py-3 font-[family-name:var(--font-mono)] text-sm leading-relaxed text-ink outline-none transition focus:border-mint/50 focus:ring-4 focus:ring-mint/15"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper transition hover:bg-ink-soft disabled:opacity-60"
            >
              {loading ? "Reading call…" : "Inspect receipt"}
            </button>
            <p className="text-xs text-ink-soft/70">
              Local heuristics · Base mainnet RPC for hashes
            </p>
          </div>
          {error ? (
            <p className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>

        <div className="rounded-[1.75rem] border border-[var(--line)] bg-ink p-5 text-paper shadow-[0_24px_70px_rgba(16,42,50,0.28)] sm:p-6">
          {!analysis ? (
            <div className="flex h-full min-h-[280px] flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">
                  Receipt card
                </p>
                <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
                  Waiting for a call
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-paper/70">
                  Run a demo or paste calldata. Your shareable risk receipt
                  appears here.
                </p>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                {["Decode", "Score", "Share"].map((step) => (
                  <div
                    key={step}
                    className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-xs font-bold tracking-wide text-paper/80"
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">
                    Receipt card
                  </p>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
                    {actionTitle(analysis)}
                  </h2>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${levelStyles[analysis.level].chip}`}
                >
                  {levelStyles[analysis.level].label}
                </span>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-end justify-between">
                  <p className="text-sm text-paper/70">Risk score</p>
                  <p className="font-[family-name:var(--font-display)] text-3xl font-bold">
                    {analysis.score}
                    <span className="text-base text-paper/50">/100</span>
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${levelStyles[analysis.level].bar}`}
                    style={{ width: `${Math.min(100, analysis.score)}%` }}
                  />
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-paper/80">
                {analysis.summary}
              </p>

              <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 font-[family-name:var(--font-mono)] text-xs text-paper/75">
                {actionLines(analysis).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <p>To {shortAddr(analysis.to)}</p>
                <p>ETH value {analysis.valueEth}</p>
                <p>
                  Builder Code{" "}
                  {analysis.builderCodePresent ? "detected" : "not found"}
                </p>
                {analysis.hash ? <p>tx {shortAddr(analysis.hash)}</p> : null}
              </div>

              <ul className="mt-5 space-y-3">
                {analysis.findings.map((finding) => (
                  <li
                    key={finding.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{finding.title}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-paper/50">
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-paper/65">
                      {finding.detail}
                    </p>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void copyShare()}
                className="mt-6 w-full rounded-full bg-mint px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-mint/90"
              >
                {copied ? "Copied share text" : "Copy share receipt"}
              </button>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-12 flex flex-col gap-2 border-t border-[var(--line)] pt-6 text-xs text-ink-soft/70 sm:flex-row sm:items-center sm:justify-between">
        <p>Receipt Guard · local heuristics, not a full security audit.</p>
        <p className="font-[family-name:var(--font-mono)]">
          Builder Code ready · Base chainId 8453
        </p>
      </footer>
    </main>
  );
}
