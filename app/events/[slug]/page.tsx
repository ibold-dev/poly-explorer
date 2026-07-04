import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvent } from "../../lib/polymarket";
import { formatUsdCompact, formatDate } from "../../lib/format";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const event = await getEvent(slug);
    if (!event) return { title: "Event Not Found" };

    return {
      title: `${event.title ?? "Event"} — Poly Explorer`,
      description: event.description ?? undefined,
    };
  } catch {
    return { title: "Event Not Found" };
  }
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEvent(slug).catch(() => null);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="mb-4 inline-block text-xs text-muted hover:text-foreground transition-colors"
      >
        ← Back to Home
      </Link>

      <div className="mb-6">
        {event.image && (
          <img
            src={event.image}
            alt=""
            className="mb-4 h-32 sm:h-48 w-full rounded-lg object-cover"
          />
        )}
        <h1 className="text-2xl font-bold text-foreground">
          {event.title ?? "Untitled Event"}
        </h1>
        {event.category && (
          <span className="mt-1 inline-block text-xs uppercase tracking-wider text-muted">
            {event.category}
          </span>
        )}
      </div>

      {event.description && (
        <p className="mb-6 text-sm leading-relaxed text-muted">
          {event.description}
        </p>
      )}

      <div className="mb-8 flex flex-wrap gap-6">
        {event.volume != null && (
          <Stat label="Volume" value={formatUsdCompact(event.volume)} />
        )}
        {event.openInterest != null && (
          <Stat label="Open Interest" value={formatUsdCompact(event.openInterest)} />
        )}
        {event.liquidity != null && (
          <Stat label="Liquidity" value={formatUsdCompact(event.liquidity)} />
        )}
        {event.endDate && (
          <Stat label="End Date" value={formatDate(event.endDate)} />
        )}
        {event.resolutionSource && (
          <Stat label="Resolution" value={event.resolutionSource} />
        )}
      </div>

      <h2 className="mb-4 text-lg font-semibold">
        Markets ({event.markets?.length ?? 0})
      </h2>
      <div className="space-y-3">
        {event.markets?.map((market) => {
          const prices = market.outcomePrices
            ? (JSON.parse(market.outcomePrices) as number[])
            : [];
          const outcomes = market.outcomes
            ? (JSON.parse(market.outcomes) as string[])
            : [];

          return (
            <Link
              key={market.id ?? market.conditionId}
              href={`/markets/${market.id}`}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card-hover"
            >
              <h3 className="mb-2 text-sm font-medium text-foreground">
                {market.question ?? "Untitled Market"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {prices.map((price, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded bg-border px-2 py-1 text-xs font-mono tabular-nums"
                  >
                    <span className="text-muted">
                      {outcomes[i] ?? `Outcome ${i + 1}`}:
                    </span>
                    <span>{(price * 100).toFixed(1)}¢</span>
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="text-sm font-mono font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
