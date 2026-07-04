"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { Trade } from "polymarket-client-ts";
import { formatUsd, formatPnl, formatDateTime } from "../lib/format";

type GroupBy = "minute" | "hour" | "day" | "week" | "month" | "year";
type Side = "ALL" | "BUY" | "SELL";

interface TradeGroup {
  label: string;
  timestamp: number;
  tradeCount: number;
  totalVolume: number;
  netPnl: number;
  trades: Trade[];
}

interface TradesExplorerProps {
  initialTrades: Trade[];
  userAddress: string;
}

const PAGE_SIZE = 100;
const BATCH_SIZE = 5000;

function getGroupKey(timestamp: number, groupBy: GroupBy): string {
  const d = new Date(timestamp * 1000);
  switch (groupBy) {
    case "minute":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    case "hour":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`;
    case "day":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    case "week": {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      return `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
    }
    case "month":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    case "year":
      return `${d.getFullYear()}`;
  }
}

function groupTrades(trades: Trade[], groupBy: GroupBy): TradeGroup[] {
  const groups = new Map<string, Trade[]>();

  for (const trade of trades) {
    if (trade.timestamp == null) continue;
    const key = getGroupKey(trade.timestamp, groupBy);
    const existing = groups.get(key);
    if (existing) {
      existing.push(trade);
    } else {
      groups.set(key, [trade]);
    }
  }

  return Array.from(groups.entries())
    .map(([label, groupTrades]) => {
      const totalVolume = groupTrades.reduce(
        (sum, t) =>
          sum +
          (t.size ?? 0) * (t.price ?? 0),
        0
      );
      const netPnl = 0;
      return {
        label,
        timestamp: groupTrades[0]?.timestamp ?? 0,
        tradeCount: groupTrades.length,
        totalVolume,
        netPnl,
        trades: groupTrades.sort(
          (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
        ),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export default function TradesExplorer({
  initialTrades,
  userAddress,
}: TradesExplorerProps) {
  const [allTrades, setAllTrades] = useState<Trade[]>(initialTrades);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [marketFilter, setMarketFilter] = useState("");
  const [sideFilter, setSideFilter] = useState<Side>("ALL");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const nextOffsetRef = useRef(initialTrades.length);

  const filteredTrades = useMemo(() => {
    return allTrades.filter((trade) => {
      if (marketFilter) {
        const q = marketFilter.toLowerCase();
        if (
          !trade.title?.toLowerCase().includes(q) &&
          !trade.slug?.toLowerCase().includes(q)
        )
          return false;
      }
      if (sideFilter !== "ALL" && trade.side !== sideFilter) return false;
      if (dateStart && trade.timestamp) {
        const start = new Date(dateStart).getTime() / 1000;
        if (trade.timestamp < start) return false;
      }
      if (dateEnd && trade.timestamp) {
        const end = new Date(dateEnd).getTime() / 1000;
        if (trade.timestamp > end) return false;
      }
      return true;
    });
  }, [allTrades, marketFilter, sideFilter, dateStart, dateEnd]);

  const groups = useMemo(
    () => groupTrades(filteredTrades, groupBy),
    [filteredTrades, groupBy]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTrades.length / PAGE_SIZE)
  );
  const paginatedGroups = groups.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleLoadMore = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/trades?user=${encodeURIComponent(userAddress)}&offset=${nextOffsetRef.current}&limit=${BATCH_SIZE}`
      );
      const data = await res.json();
      const newTrades: Trade[] = data.trades ?? [];
      if (newTrades.length === 0) {
        setHasMore(false);
      } else {
        setAllTrades((prev) => [...prev, ...newTrades]);
        nextOffsetRef.current += newTrades.length;
        if (newTrades.length < BATCH_SIZE) {
          setHasMore(false);
        }
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  const handleExport = useCallback(() => {
    const exportData = {
      user: userAddress,
      filters: {
        market: marketFilter || "ALL",
        side: sideFilter,
        dateRange:
          dateStart || dateEnd
            ? `${dateStart || "..."} – ${dateEnd || "..."}`
            : "ALL",
      },
      groupBy,
      groups: groups.map((g) => ({
        label: g.label,
        tradeCount: g.tradeCount,
        totalVolume: g.totalVolume,
        netPnl: g.netPnl,
        trades: g.trades,
      })),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${userAddress.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [userAddress, marketFilter, sideFilter, dateStart, dateEnd, groupBy, groups]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted">
          {allTrades.length.toLocaleString()} trades loaded
        </span>
        {hasMore && (
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        )}
        <button
          onClick={handleExport}
          className="rounded bg-card border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-card-hover transition-colors"
        >
          Download JSON
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filter by market…"
          value={marketFilter}
          onChange={(e) => {
            setMarketFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent w-40"
        />

        <select
          value={sideFilter}
          onChange={(e) => {
            setSideFilter(e.target.value as Side);
            setCurrentPage(1);
          }}
          className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
        >
          <option value="ALL">All Sides</option>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>

        <input
          type="date"
          value={dateStart}
          onChange={(e) => {
            setDateStart(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
        />
        <span className="text-[10px] text-muted">to</span>
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => {
            setDateEnd(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
        />

        <select
          value={groupBy}
          onChange={(e) => {
            setGroupBy(e.target.value as GroupBy);
            setCurrentPage(1);
          }}
          className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
        >
          <option value="minute">Minute</option>
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </select>
      </div>

      <div className="mb-4 flex items-center gap-4 text-xs text-muted">
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded bg-card border border-border px-2 py-0.5 text-xs disabled:opacity-30 hover:bg-card-hover transition-colors"
          >
            Prev
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded bg-card border border-border px-2 py-0.5 text-xs disabled:opacity-30 hover:bg-card-hover transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {paginatedGroups.map((group) => (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className="flex w-full items-center justify-between rounded border border-border bg-card px-3 py-2 text-left hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] transition-transform ${
                    expandedGroups.has(group.label) ? "rotate-90" : ""
                  }`}
                >
                  ▶
                </span>
                <span className="text-xs font-medium text-foreground">
                  {group.label}
                </span>
                <span className="text-[10px] text-muted">
                  {group.tradeCount} trade{group.tradeCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                <span className="text-muted">
                  {formatUsd(group.totalVolume)}
                </span>
                {group.netPnl !== 0 && (
                  <span
                    className={
                      group.netPnl > 0 ? "text-profit" : "text-loss"
                    }
                  >
                    {formatPnl(group.netPnl)}
                  </span>
                )}
              </div>
            </button>

            {expandedGroups.has(group.label) && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
                      <th className="px-3 py-1.5 font-medium">Time</th>
                      <th className="px-3 py-1.5 font-medium">Market</th>
                      <th className="px-3 py-1.5 font-medium">Side</th>
                      <th className="px-3 py-1.5 font-medium text-right">
                        Size
                      </th>
                      <th className="px-3 py-1.5 font-medium text-right">
                        Price
                      </th>
                      <th className="px-3 py-1.5 font-medium text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.trades.map((trade, i) => (
                      <tr
                        key={trade.transactionHash ?? i}
                        className="border-b border-border/30"
                      >
                        <td className="px-3 py-1.5 text-muted font-mono tabular-nums whitespace-nowrap">
                          {trade.timestamp
                            ? formatDateTime(trade.timestamp)
                            : "-"}
                        </td>
                        <td className="px-3 py-1.5 max-w-[200px] truncate">
                          {trade.title ?? "Unknown"}
                        </td>
                        <td
                          className={`px-3 py-1.5 font-medium ${
                            trade.side === "BUY"
                              ? "text-profit"
                              : trade.side === "SELL"
                                ? "text-loss"
                                : ""
                          }`}
                        >
                          {trade.side ?? "-"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          {trade.size?.toFixed(2) ?? "-"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          {trade.price != null
                            ? `${(trade.price * 100).toFixed(1)}¢`
                            : "-"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          {trade.size != null && trade.price != null
                            ? formatUsd(trade.size * trade.price)
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {paginatedGroups.length === 0 && (
        <p className="py-8 text-center text-xs text-muted">
          No trades match the current filters.
        </p>
      )}
    </div>
  );
}
