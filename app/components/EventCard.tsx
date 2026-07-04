import Link from "next/link";
import type { Event } from "polymarket-client-ts";
import { formatUsdCompact, formatDate } from "../lib/format";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const marketCount = event.markets?.length ?? 0;
  const topMarket = event.markets?.[0];

  return (
    <Link
      href={`/events/${event.slug ?? event.id}`}
      className="group block rounded-lg border border-border bg-card p-3 sm:p-4 transition-colors hover:bg-card-hover"
    >
      <div className="mb-2 flex items-start gap-3">
        {event.image && (
          <img
            src={event.image}
            alt=""
            className="mt-0.5 h-10 w-10 rounded-md object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
            {event.title ?? "Untitled Event"}
          </h3>
          {event.category && (
            <span className="text-[10px] uppercase tracking-wider text-muted">
              {event.category}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{marketCount} market{marketCount !== 1 ? "s" : ""}</span>
        {event.volume != null && (
          <span>{formatUsdCompact(event.volume)} vol</span>
        )}
        {event.endDate && (
          <span>Ends {formatDate(event.endDate)}</span>
        )}
      </div>

      {topMarket?.outcomePrices && (
        <div className="mt-2 flex gap-2">
          {JSON.parse(topMarket.outcomePrices).map(
            (price: number, i: number) => (
              <span
                key={i}
                className="rounded bg-border px-1.5 py-0.5 text-xs font-mono tabular-nums"
              >
                {(price * 100).toFixed(1)}¢
              </span>
            )
          )}
        </div>
      )}
    </Link>
  );
}
