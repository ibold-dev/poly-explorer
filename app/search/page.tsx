import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { search, getProfile } from "../lib/polymarket";
import Link from "next/link";
import { truncateAddress } from "../lib/format";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q} — Poly Explorer` : "Search — Poly Explorer",
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  if (!q || !q.trim()) notFound();

  const trimmed = q.trim();

  const [results, addressProfile] = await Promise.all([
    search({
      q: trimmed,
      limit_per_type: 50,
      search_profiles: true,
      search_tags: true,
    }).catch(() => null),
    ADDRESS_RE.test(trimmed)
      ? getProfile(trimmed.toLowerCase()).catch(() => null)
      : null,
  ]);

  if (!results && !addressProfile) notFound();

  const events = results?.events ?? [];
  const profiles = results?.profiles ?? [];
  const tags = results?.tags ?? [];

  if (addressProfile) {
    const alreadyListed = profiles.some(
      (p) => p.proxyWallet?.toLowerCase() === trimmed.toLowerCase()
    );
    if (!alreadyListed) {
      profiles.unshift({
        proxyWallet: trimmed.toLowerCase(),
        name: addressProfile.name,
        pseudonym: addressProfile.pseudonym,
        profileImage: addressProfile.profileImage,
      } as any);
    }
  }

  const total = events.length + profiles.length + tags.length;
  const totalResults = results?.pagination?.totalResults ?? total;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold text-foreground">
        Search results for &ldquo;{trimmed}&rdquo;
      </h1>
      <p className="mb-6 text-xs text-muted">
        {totalResults} result{totalResults !== 1 ? "s" : ""}
      </p>

      {total === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          No results found.
        </p>
      )}

      {profiles.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Profiles ({profiles.length})
          </h2>
          <div className="space-y-2">
            {profiles.map((profile) => (
              <Link
                key={profile.id ?? profile.proxyWallet}
                href={`/users/${profile.proxyWallet}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-card-hover"
              >
                {profile.profileImage ? (
                  <img
                    src={profile.profileImage}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-border text-xs font-semibold text-muted">
                    {(profile.name ?? profile.pseudonym ?? "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">
                    {profile.name ?? profile.pseudonym ?? "Anonymous"}
                  </div>
                  {profile.proxyWallet && (
                    <div className="text-xs text-muted font-mono">
                      {truncateAddress(profile.proxyWallet)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Events ({events.length})
          </h2>
          <div className="space-y-2">
            {events.map((event) => (
              <Link
                key={event.id ?? event.slug}
                href={`/events/${event.slug ?? event.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-card-hover"
              >
                {event.image && (
                  <img
                    src={event.image}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">
                    {event.title ?? "Untitled"}
                  </div>
                  {event.category && (
                    <div className="text-xs text-muted">{event.category}</div>
                  )}
                </div>
                <div className="text-xs text-muted tabular-nums shrink-0">
                  {event.markets?.length ?? 0} markets
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Tags ({tags.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id ?? tag.slug}
                className="rounded bg-card border border-border px-3 py-1.5 text-xs text-foreground"
              >
                {tag.label ?? tag.slug}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
