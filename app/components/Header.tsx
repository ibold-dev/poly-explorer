'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

export default function Header() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (q) {
        router.push(`/search?q=${encodeURIComponent(q)}`);
        setQuery('');
        setMenuOpen(false);
      }
    },
    [query, router]
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-4 px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground shrink-0"
        >
          <span className="text-accent">◆</span>
          <span>Poly Explorer</span>
        </Link>

        {/* Desktop nav + search */}
        <nav className="hidden items-center gap-6 md:flex flex-1">
          <Link
            href="/leaderboard"
            className="text-xs font-medium text-muted hover:text-foreground transition-colors"
          >
            Leaderboard
          </Link>
          <form onSubmit={handleSearch} className="flex-1 max-w-md ml-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search markets, events, users…"
              className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent transition-colors"
            />
          </form>
        </nav>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-foreground md:hidden"
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-3">
            <Link
              href="/leaderboard"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-muted hover:text-foreground"
            >
              Leaderboard
            </Link>
            <form onSubmit={handleSearch}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search markets, events, users…"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
              />
            </form>
          </nav>
        </div>
      )}
    </header>
  );
}
