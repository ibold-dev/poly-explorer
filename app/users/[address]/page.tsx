import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProfile,
  getCurrentPositions,
  getClosedPositions,
  getTotalValue,
  getProfitMetrics,
} from "../../lib/polymarket";
import { formatUsd, formatPnl } from "../../lib/format";
import UserProfileCard from "../../components/UserProfileCard";
import PositionsTable from "../../components/PositionsTable";
import StatBadge from "../../components/StatBadge";
import Link from "next/link";
import { Suspense } from "react";
import Skeleton from "../../components/Skeleton";

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { address } = await params;
    const profile = await getProfile(address);
    const name = profile.name ?? profile.pseudonym ?? address.slice(0, 10);
    return {
      title: `${name} — Poly Explorer`,
      description: profile.bio ?? `Polymarket user profile for ${name}`,
    };
  } catch {
    return { title: "User Not Found — Poly Explorer" };
  }
}

export default async function UserPage({ params }: Props) {
  const { address } = await params;

  const [profile, totalValue, profitMetrics] = await Promise.all([
    getProfile(address).catch(() => null),
    getTotalValue(address).catch(() => []),
    getProfitMetrics(address).catch(() => null),
  ]);

  if (!profile) notFound();

  const portfolioValue = totalValue[0]?.value ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="mb-4 inline-block text-xs text-muted hover:text-foreground transition-colors"
      >
        ← Back to Home
      </Link>

      <UserProfileCard profile={profile} address={address} />

      <div className="mt-4 mb-6 flex flex-wrap gap-3 sm:gap-6">
        <StatBadge
          label="Portfolio Value"
          value={formatUsd(portfolioValue)}
        />
        {profitMetrics && (
          <>
            <StatBadge
              label="Daily PnL"
              value={formatPnl(profitMetrics.daily)}
              profit={profitMetrics.daily > 0}
              loss={profitMetrics.daily < 0}
            />
            <StatBadge
              label="Weekly PnL"
              value={formatPnl(profitMetrics.weekly)}
              profit={profitMetrics.weekly > 0}
              loss={profitMetrics.weekly < 0}
            />
            <StatBadge
              label="Monthly PnL"
              value={formatPnl(profitMetrics.monthly)}
              profit={profitMetrics.monthly > 0}
              loss={profitMetrics.monthly < 0}
            />
            <StatBadge
              label="YTD PnL"
              value={formatPnl(profitMetrics.ytd)}
              profit={profitMetrics.ytd > 0}
              loss={profitMetrics.ytd < 0}
            />
          </>
        )}
      </div>

      <div className="mb-4 flex items-center gap-4 border-b border-border">
        <span className="border-b-2 border-accent pb-2 text-xs font-medium text-foreground">
          Positions
        </span>
        <Link
          href={`/users/${address}/trades`}
          className="pb-2 text-xs font-medium text-muted hover:text-foreground transition-colors"
        >
          Trades
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        }
      >
        <CurrentPositionsSection address={address} />
      </Suspense>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Closed Positions
        </h3>
        <Suspense
          fallback={
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          }
        >
          <ClosedPositionsSection address={address} />
        </Suspense>
      </div>
    </div>
  );
}

async function CurrentPositionsSection({
  address,
}: {
  address: string;
}) {
  const positions = await getCurrentPositions({
    user: address,
    limit: 50,
  }).catch(() => []);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Open Positions ({positions.length})
      </h3>
      <PositionsTable positions={positions} type="current" />
    </div>
  );
}

async function ClosedPositionsSection({
  address,
}: {
  address: string;
}) {
  const positions = await getClosedPositions({
    user: address,
    limit: 20,
  }).catch(() => []);

  return <PositionsTable positions={positions} type="closed" />;
}
