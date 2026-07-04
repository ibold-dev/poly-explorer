import { Suspense } from "react";
import { getEvents, getMarkets } from "./lib/polymarket";
import EventCard from "./components/EventCard";
import MarketCard from "./components/MarketCard";
import Skeleton from "./components/Skeleton";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section className="mb-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Poly Explorer
        </h1>
        <p className="mt-1 text-sm text-muted">
          Explore Polymarket events, markets, and traders
        </p>
      </section>

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        }
      >
        <FeaturedEvents />
      </Suspense>

      <Suspense
        fallback={
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        }
      >
        <TopMarkets />
      </Suspense>
    </div>
  );
}

async function FeaturedEvents() {
  const [eventsResult, eventsResult2] = await Promise.all([
    getEvents({ featured: true, limit: 6, closed: false }),
    getEvents({ limit: 6, closed: false }),
  ]);

  const events = [
    ...(eventsResult.events ?? []),
    ...(eventsResult2.events ?? []),
  ].slice(0, 9);

  if (events.length === 0) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-semibold">Featured Events</h2>
        <p className="text-xs text-muted">No events available.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Events</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id ?? event.slug} event={event} />
        ))}
      </div>
    </section>
  );
}

async function TopMarkets() {
  const result = await getMarkets({
    limit: 9,
    closed: false,
  });

  const markets = result.markets ?? [];

  if (markets.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Top Markets</h2>
        <p className="text-xs text-muted">No markets available.</p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold">Markets</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {markets.map((market) => (
          <MarketCard key={market.id ?? market.conditionId} market={market} />
        ))}
      </div>
    </section>
  );
}
