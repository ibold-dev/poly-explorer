import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import {
  PolymarketClient,
  type GetTradesParams,
  type GetPositionsParams,
  type GetClosedPositionsParams,
  type GetLeaderboardParams,
  type GetMarketPositionsParams,
} from 'polymarket-client-ts';

// Singleton client — module-level, no mutable request state (server-no-shared-module-state)
const client = new PolymarketClient();

// ──────────────────────────────────────────────
// Events
// ──────────────────────────────────────────────

export const getEvents = cache(
  (params?: Parameters<typeof client.events.getEventsKeyset>[0]) =>
    unstable_cache(
      async () => client.events.getEventsKeyset(params),
      ['events', JSON.stringify(params ?? {})],
      { revalidate: 60, tags: ['events'] }
    )()
);

export const getEvent = cache((slug: string) =>
  unstable_cache(
    async () => client.events.getEventBySlug(slug),
    ['event', slug],
    { revalidate: 30, tags: ['event', slug] }
  )()
);

export const getEventById = cache((id: string) =>
  unstable_cache(
    async () => client.events.getEvent(id),
    ['event-id', id],
    { revalidate: 30, tags: ['event'] }
  )()
);

// ──────────────────────────────────────────────
// Markets
// ──────────────────────────────────────────────

export const getMarkets = cache(
  (params?: Parameters<typeof client.markets.getMarketsKeyset>[0]) =>
    unstable_cache(
      async () => client.markets.getMarketsKeyset(params),
      ['markets', JSON.stringify(params ?? {})],
      { revalidate: 60, tags: ['markets'] }
    )()
);

export const getMarket = cache((id: string) =>
  unstable_cache(
    async () => client.markets.getMarket(id),
    ['market', id],
    { revalidate: 30, tags: ['market', id] }
  )()
);

export const getMarketBySlug = cache((slug: string) =>
  unstable_cache(
    async () => client.markets.getMarketBySlug(slug),
    ['market-slug', slug],
    { revalidate: 30, tags: ['market'] }
  )()
);

export const getOpenInterest = cache(
  (params?: Parameters<typeof client.markets.getOpenInterest>[0]) =>
    unstable_cache(
      async () => client.markets.getOpenInterest(params),
      ['oi', JSON.stringify(params ?? {})],
      { revalidate: 60, tags: ['oi'] }
    )()
);

export const getMarketPositions = cache(
  (params: GetMarketPositionsParams) =>
    unstable_cache(
      async () => client.positions.getMarketPositions(params),
      ['market-positions', JSON.stringify(params)],
      { revalidate: 120, tags: ['market-positions'] }
    )()
);

// ──────────────────────────────────────────────
// User Profile
// ──────────────────────────────────────────────

export const getProfile = cache((address: string) =>
  unstable_cache(
    async () => client.profile.getPublicProfile(address),
    ['profile', address],
    { revalidate: 300, tags: ['profile', address] }
  )()
);

// ──────────────────────────────────────────────
// Positions
// ──────────────────────────────────────────────

export const getCurrentPositions = cache(
  (params: GetPositionsParams) =>
    unstable_cache(
      async () => client.positions.getCurrentPositions(params),
      ['positions', JSON.stringify(params)],
      { revalidate: 120, tags: ['positions'] }
    )()
);

export const getClosedPositions = cache(
  (params: GetClosedPositionsParams) =>
    unstable_cache(
      async () => client.positions.getClosedPositions(params),
      ['closed-positions', JSON.stringify(params)],
      { revalidate: 120, tags: ['closed-positions'] }
    )()
);

export const getTotalValue = cache((address: string) =>
  unstable_cache(
    async () => client.positions.getTotalValue({ user: address }),
    ['total-value', address],
    { revalidate: 120, tags: ['total-value'] }
  )()
);

// ──────────────────────────────────────────────
// Trades
// ──────────────────────────────────────────────

export const getTrades = cache(
  (params: GetTradesParams) =>
    unstable_cache(
      async () => client.trades.getTrades(params),
      ['trades', JSON.stringify(params)],
      { revalidate: 120, tags: ['trades'] }
    )()
);

// ──────────────────────────────────────────────
// PnL
// ──────────────────────────────────────────────

export const getProfitMetrics = cache((address: string) =>
  unstable_cache(
    async () => client.pnl.getProfitMetrics(address),
    ['pnl', address],
    { revalidate: 300, tags: ['pnl', address] }
  )()
);

// ──────────────────────────────────────────────
// Leaderboard
// ──────────────────────────────────────────────

export const getLeaderboard = cache(
  (params?: GetLeaderboardParams) =>
    unstable_cache(
      async () => client.leaderboard.getLeaderboard(params),
      ['leaderboard', JSON.stringify(params ?? {})],
      { revalidate: 120, tags: ['leaderboard'] }
    )()
);

// ──────────────────────────────────────────────
// Search
// ──────────────────────────────────────────────

export const search = cache(
  (params: Parameters<typeof client.search.search>[0]) =>
    // No cache for search — always fresh
    client.search.search(params)
);

// ──────────────────────────────────────────────
// Activity
// ──────────────────────────────────────────────

export const getActivity = cache(
  (params: Parameters<typeof client.activity.getUserActivity>[0]) =>
    unstable_cache(
      async () => client.activity.getUserActivity(params),
      ['activity', JSON.stringify(params)],
      { revalidate: 120, tags: ['activity'] }
    )()
);

// ──────────────────────────────────────────────
// Tags
// ──────────────────────────────────────────────

export const getTags = cache(() =>
  unstable_cache(
    async () => client.tags.getTags(),
    ['tags'],
    { revalidate: 600, tags: ['tags'] }
  )()
);
