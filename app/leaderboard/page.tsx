import type { Metadata } from "next";
import { getLeaderboard } from "../lib/polymarket";
import { formatUsdCompact, formatPnl, truncateAddress } from "../lib/format";
import Link from "next/link";
import { Suspense } from "react";
import Skeleton from "../components/Skeleton";

interface Props {
  searchParams: Promise<{
    category?: string;
    period?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Leaderboard — Poly Explorer",
  description: "Top traders on Polymarket by volume and PnL.",
};

const CATEGORIES = [
  "OVERALL",
  "POLITICS",
  "SPORTS",
  "ESPORTS",
  "CRYPTO",
  "CULTURE",
  "WEATHER",
  "ECONOMICS",
  "TECH",
] as const;

const PERIODS = ["DAY", "WEEK", "MONTH", "ALL"] as const;

export default async function LeaderboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = (sp.category ?? "OVERALL") as (typeof CATEGORIES)[number];
  const period = (sp.period ?? "ALL") as (typeof PERIODS)[number];

  const validCategory = CATEGORIES.includes(category as any)
    ? category
    : "OVERALL";
  const validPeriod = PERIODS.includes(period as any) ? period : "ALL";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold text-foreground">Leaderboard</h1>
      <p className="mb-6 text-xs text-muted">
        Top traders ranked by volume and PnL
      </p>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted mr-1">
            Category:
          </span>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/leaderboard?category=${cat}&period=${validPeriod}`}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                validCategory === cat
                  ? "bg-accent text-white"
                  : "bg-card text-muted hover:text-foreground"
              }`}
            >
              {cat.charAt(0) + cat.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted mr-1">
            Period:
          </span>
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/leaderboard?category=${validCategory}&period=${p}`}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                validPeriod === p
                  ? "bg-accent text-white"
                  : "bg-card text-muted hover:text-foreground"
              }`}
            >
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
      </div>

      <Suspense
        fallback={
          <div className="space-y-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <LeaderboardTable
          category={validCategory as any}
          period={validPeriod as any}
        />
      </Suspense>
    </div>
  );
}

async function LeaderboardTable({
  category,
  period,
}: {
  category: (typeof CATEGORIES)[number];
  period: (typeof PERIODS)[number];
}) {
  const entries = await getLeaderboard({
    category: category as any,
    timePeriod: period as any,
    limit: 50,
  });

  if (entries.length === 0) {
    return <p className="py-8 text-center text-xs text-muted">No data.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="pb-2 pr-4 font-medium w-8">#</th>
            <th className="pb-2 pr-4 font-medium">Trader</th>
            <th className="pb-2 pr-4 font-medium text-right">Volume</th>
            <th className="pb-2 pr-4 font-medium text-right">PnL</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.proxyWallet} className="border-b border-border/50">
              <td className="py-2 pr-4 font-mono tabular-nums text-muted">
                {entry.rank ?? "-"}
              </td>
              <td className="py-2 pr-4">
                <Link
                  href={`/users/${entry.proxyWallet}`}
                  className="flex items-center gap-2 text-accent hover:underline"
                >
                  {entry.profileImage && (
                    <img
                      src={entry.profileImage}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  )}
                  <span>
                    {entry.userName ??
                      (entry.proxyWallet
                        ? truncateAddress(entry.proxyWallet)
                        : "Anonymous")}
                  </span>
                  {entry.verifiedBadge && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="#3b82f6"
                    >
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                    </svg>
                  )}
                </Link>
              </td>
              <td className="py-2 pr-4 text-right font-mono tabular-nums">
                {formatUsdCompact(entry.vol)}
              </td>
              <td
                className={`py-2 pr-4 text-right font-mono tabular-nums ${
                  entry.pnl != null
                    ? entry.pnl > 0
                      ? "text-profit"
                      : entry.pnl < 0
                        ? "text-loss"
                        : ""
                    : ""
                }`}
              >
                {entry.pnl != null ? formatPnl(entry.pnl) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
