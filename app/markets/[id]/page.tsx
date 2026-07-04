import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMarket, getOpenInterest, getMarketPositions } from "../../lib/polymarket";
import { formatUsdCompact, formatUsd, formatPercent } from "../../lib/format";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const market = await getMarket(id);
    if (!market) return { title: "Market Not Found" };

    return {
      title: `${market.question ?? "Market"} — Poly Explorer`,
      description: market.description ?? undefined,
    };
  } catch {
    return { title: "Market Not Found" };
  }
}

export default async function MarketPage({ params }: Props) {
  const { id } = await params;
  const [market, oiResult, positionsResult] = await Promise.all([
    getMarket(id).catch(() => null),
    getOpenInterest({ market: [id] }).catch(() => []),
    getMarketPositions({ market: id, limit: 20 }).catch(() => []),
  ]);

  if (!market) notFound();

  const prices = market.outcomePrices
    ? (JSON.parse(market.outcomePrices) as number[])
    : [];
  const outcomes = market.outcomes
    ? (JSON.parse(market.outcomes) as string[])
    : [];
  const openInterest = oiResult.find((o) => o.market === id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="mb-4 inline-block text-xs text-muted hover:text-foreground transition-colors"
      >
        ← Back to Home
      </Link>

      <h1 className="mb-4 text-2xl font-bold text-foreground">
        {market.question ?? "Untitled Market"}
      </h1>

      <div className="mb-6 flex flex-wrap gap-6">
        {market.volumeNum != null && (
          <Stat label="Volume" value={formatUsdCompact(market.volumeNum)} />
        )}
        {market.volume24hr != null && (
          <Stat label="24h Volume" value={formatUsdCompact(market.volume24hr)} />
        )}
        {openInterest != null && (
          <Stat label="Open Interest" value={formatUsdCompact(openInterest.value)} />
        )}
        {market.liquidityNum != null && (
          <Stat label="Liquidity" value={formatUsdCompact(market.liquidityNum)} />
        )}
        {market.oneDayPriceChange != null && (
          <Stat
            label="24h Change"
            value={formatPercent(market.oneDayPriceChange)}
            profit={market.oneDayPriceChange > 0}
            loss={market.oneDayPriceChange < 0}
          />
        )}
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        {prices.map((price, i) => (
          <div
            key={i}
            className="min-w-[120px] flex-1 rounded-lg border border-border bg-card p-4"
          >
            <div className="text-xs text-muted mb-1">
              {outcomes[i] ?? `Outcome ${i + 1}`}
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-foreground">
              {(price * 100).toFixed(1)}¢
            </div>
          </div>
        ))}
      </div>

      {market.description && (
        <p className="mb-8 text-sm leading-relaxed text-muted">
          {market.description}
        </p>
      )}

      {market.closed && (
        <div className="mb-8 rounded-lg bg-loss/10 border border-loss/20 px-4 py-3">
          <span className="text-xs font-medium text-loss">This market is closed</span>
        </div>
      )}

      <h2 className="mb-4 text-lg font-semibold">Top Positions</h2>
      {positionsResult.length === 0 ? (
        <p className="text-xs text-muted">
          No position data available.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="pb-2 pr-4 font-medium">Trader</th>
                <th className="pb-2 pr-4 font-medium">Outcome</th>
                <th className="pb-2 pr-4 font-medium text-right">Size</th>
                <th className="pb-2 pr-4 font-medium text-right">Avg Price</th>
                <th className="pb-2 pr-4 font-medium text-right">Value</th>
                <th className="pb-2 pr-4 font-medium text-right">PnL</th>
              </tr>
            </thead>
            <tbody>
              {positionsResult.flatMap((meta) =>
                (meta.positions ?? []).map((pos, i) => (
                  <tr
                    key={`${meta.token}-${i}`}
                    className="border-b border-border/50"
                  >
                    <td className="py-2 pr-4">
                      {pos.name ? (
                        <Link
                          href={`/users/${pos.proxyWallet}`}
                          className="text-accent hover:underline"
                        >
                          {pos.name}
                        </Link>
                      ) : (
                        <span className="text-muted font-mono">
                          {pos.proxyWallet?.slice(0, 6)}...
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono tabular-nums">
                      {pos.outcome ?? "-"}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums">
                      {pos.size?.toFixed(2) ?? "-"}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums">
                      {pos.avgPrice != null
                        ? `${(pos.avgPrice * 100).toFixed(1)}¢`
                        : "-"}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums">
                      {pos.currentValue != null
                        ? formatUsd(pos.currentValue)
                        : "-"}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right font-mono tabular-nums ${pos.cashPnl != null ? (pos.cashPnl > 0 ? "text-profit" : pos.cashPnl < 0 ? "text-loss" : "") : ""}`}
                    >
                      {pos.cashPnl != null ? formatUsd(pos.cashPnl) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  profit,
  loss,
}: {
  label: string;
  value: string;
  profit?: boolean;
  loss?: boolean;
}) {
  const color = profit ? "text-profit" : loss ? "text-loss" : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className={`text-sm font-mono font-medium tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}
