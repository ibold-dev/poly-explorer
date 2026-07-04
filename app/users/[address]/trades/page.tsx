import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfile, getTrades } from "../../../lib/polymarket";
import TradesExplorer from "../../../components/TradesExplorer";
import Link from "next/link";
import { truncateAddress } from "../../../lib/format";

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { address } = await params;
    const profile = await getProfile(address);
    const name = profile.name ?? profile.pseudonym ?? truncateAddress(address);
    return {
      title: `${name} — Trades — Poly Explorer`,
      description: `Trade history for ${name} on Polymarket.`,
    };
  } catch {
    return { title: "Trades — Poly Explorer" };
  }
}

export default async function UserTradesPage({ params }: Props) {
  const { address } = await params;

  const profile = await getProfile(address).catch(() => null);
  if (!profile) notFound();

  const initialTrades = await getTrades({
    user: address,
    limit: 5000,
    offset: 0,
    takerOnly: true,
  }).catch(() => []);

  const displayName =
    profile.name ?? profile.pseudonym ?? truncateAddress(address);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href={`/users/${address}`}
        className="mb-4 inline-block text-xs text-muted hover:text-foreground transition-colors"
      >
        ← Back to Profile
      </Link>

      <h1 className="mb-1 text-xl font-bold text-foreground">
        {displayName}&rsquo;s Trades
      </h1>
      <p className="mb-6 text-xs text-muted font-mono">
        {address}
      </p>

      <TradesExplorer
        initialTrades={initialTrades}
        userAddress={address}
      />
    </div>
  );
}
