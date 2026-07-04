import Link from "next/link";
import type { Market } from "polymarket-client-ts";
import { formatUsdCompact } from "../lib/format";

interface MarketCardProps {
  market: Market;
}

export default function MarketCard({ market }: MarketCardProps) {
  const prices = market.outcomePrices
    ? (JSON.parse(market.outcomePrices) as number[])
    : [];

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group block rounded-lg border border-border bg-card p-3 sm:p-4 transition-colors hover:bg-card-hover"
    >
      <h3 className="mb-2 text-sm font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2">
        {market.question ?? "Untitled Market"}
      </h3>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {prices.map((price, i) => {
          const outcomes = market.outcomes
            ? JSON.parse(market.outcomes)
            : [];
          const label = outcomes[i] ?? `Outcome ${i + 1}`;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded bg-border px-1.5 py-0.5 text-xs font-mono tabular-nums"
              title={label}
            >
              <span className="max-w-[60px] truncate text-muted">{label}:</span>
              <span className="font-medium">{(price * 100).toFixed(1)}¢</span>
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted">
        {market.volumeNum != null && (
          <span>{formatUsdCompact(market.volumeNum)} vol</span>
        )}
        {market.liquidityNum != null && (
          <span>{formatUsdCompact(market.liquidityNum)} liq</span>
        )}
        {market.closed && (
          <span className="rounded bg-loss/20 px-1 py-0.5 text-[10px] font-medium text-loss">
            Closed
          </span>
        )}
      </div>
    </Link>
  );
}
