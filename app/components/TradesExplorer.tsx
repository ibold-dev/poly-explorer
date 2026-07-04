"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { Trade } from "polymarket-client-ts";
import { formatUsd, formatUsdCompact, formatPnl, formatDateTime } from "../lib/format";

type GroupBy = "minute" | "hour" | "day" | "week" | "month" | "year";
type Side = "ALL" | "BUY" | "SELL";
type AssetCategory = "ALL" | "BTC" | "ETH" | "SOL" | "XRP" | "GENERAL";
type PeriodDuration = "ALL" | "5m" | "15m" | "1hr" | "GENERAL";
type ViewLevel = "assets" | "periods" | "months" | "days" | "slots" | "trades";

interface TimeSlot {
  key: string;
  label: string;
  startHour: number;
  startMin: number;
}

interface TradesExplorerProps {
  initialTrades: Trade[];
  userAddress: string;
}

const PAGE_SIZE = 50;
const BATCH_SIZE = 5000;

// Helper to classify cryptocurrency/asset from title/slug
function extractCryptocurrency(title?: string, slug?: string): AssetCategory {
  const text = `${title ?? ""} ${slug ?? ""}`.toLowerCase();
  if (text.includes("bitcoin") || text.includes("btc")) return "BTC";
  if (text.includes("ethereum") || text.includes("eth")) return "ETH";
  if (text.includes("solana") || text.includes("sol")) return "SOL";
  if (text.includes("ripple") || text.includes("xrp")) return "XRP";
  return "GENERAL";
}

// Helper to classify period duration from event slug
function extractPeriodDuration(slug?: string): PeriodDuration {
  if (!slug) return "GENERAL";
  const slugLower = slug.toLowerCase();
  if (slugLower.includes("15m") || slugLower.includes("-15m-")) return "15m";
  if (slugLower.includes("5m") || slugLower.includes("-5m-")) return "5m";
  if (
    slugLower.includes("1hr") ||
    slugLower.includes("1h") ||
    slugLower.includes("up-or-down") ||
    slugLower.includes("updown")
  ) {
    return "1hr";
  }
  return "GENERAL";
}

// Helpers for human dates
function formatHumanMonth(monthStr: string): string {
  const parts = monthStr.split("-");
  if (parts.length !== 2) return monthStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[monthIdx]} ${year}`;
}

function formatHumanDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[monthIdx]} ${year}`;
}

// Get slot for time windowing
function getTradeSlot(timestamp: number, period: PeriodDuration): TimeSlot {
  const d = new Date(timestamp * 1000);
  const hour = d.getHours();
  const min = d.getMinutes();

  let bracketSize = 60;
  if (period === "5m") bracketSize = 5;
  if (period === "15m") bracketSize = 15;
  if (period === "1hr") bracketSize = 60;

  const slotIndex = Math.floor(min / bracketSize);
  const startMin = slotIndex * bracketSize;
  const startHour = hour;

  const endMin = startMin + bracketSize;
  let endHour = hour;
  let displayEndMin = endMin;

  if (endMin >= 60) {
    displayEndMin = 0;
    endHour = (hour + 1) % 24;
  }

  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const label = `${formatTime(startHour, startMin)} - ${formatTime(endHour, displayEndMin)}`;
  const key = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;

  return { key, label, startHour, startMin };
}

export default function TradesExplorer({
  initialTrades,
  userAddress,
}: TradesExplorerProps) {
  const [allTrades, setAllTrades] = useState<Trade[]>(initialTrades);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Progressive State Navigation
  const [viewLevel, setViewLevel] = useState<ViewLevel>("assets");
  const [selectedAsset, setSelectedAsset] = useState<AssetCategory>("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodDuration>("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null); // "yyyy-MM"
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // "yyyy-MM-dd"
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Multi-Select Sets for level-by-level exports
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()); // unique: `${selectedDay}_${slot.key}`

  // General Filter options (persist through levels)
  const [marketFilter, setMarketFilter] = useState("");
  const [sideFilter, setSideFilter] = useState<Side>("ALL");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const nextOffsetRef = useRef(initialTrades.length);

  // Classified initial trades
  const classifiedTrades = useMemo(() => {
    return allTrades.map((t) => ({
      ...t,
      classifiedAsset: extractCryptocurrency(t.title, t.slug),
      classifiedPeriod: extractPeriodDuration(t.slug),
    }));
  }, [allTrades]);

  // Aggregate loaded stats by category
  const categoryStats = useMemo(() => {
    const stats: Record<AssetCategory, { count: number; volume: number }> = {
      ALL: { count: 0, volume: 0 },
      BTC: { count: 0, volume: 0 },
      ETH: { count: 0, volume: 0 },
      SOL: { count: 0, volume: 0 },
      XRP: { count: 0, volume: 0 },
      GENERAL: { count: 0, volume: 0 },
    };

    classifiedTrades.forEach((t) => {
      const vol = (t.size ?? 0) * (t.price ?? 0);
      stats.ALL.count++;
      stats.ALL.volume += vol;

      const cat = t.classifiedAsset;
      stats[cat].count++;
      stats[cat].volume += vol;
    });

    return stats;
  }, [classifiedTrades]);

  // Filter based on standard input filters + level selections
  const filteredTrades = useMemo(() => {
    return classifiedTrades.filter((trade) => {
      // General side filters
      if (sideFilter !== "ALL" && trade.side !== sideFilter) return false;

      // General query filters
      if (marketFilter) {
        const q = marketFilter.toLowerCase();
        if (
          !trade.title?.toLowerCase().includes(q) &&
          !trade.slug?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      // Date constraints
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
  }, [classifiedTrades, sideFilter, marketFilter, dateStart, dateEnd]);

  // Filter specifically for Category Selection
  const categoryFilteredTrades = useMemo(() => {
    return filteredTrades.filter((t) => {
      if (selectedAsset !== "ALL" && t.classifiedAsset !== selectedAsset) return false;
      return true;
    });
  }, [filteredTrades, selectedAsset]);

  // Filter specifically for Period Selection
  const periodFilteredTrades = useMemo(() => {
    return categoryFilteredTrades.filter((t) => {
      if (selectedPeriod !== "ALL" && t.classifiedPeriod !== selectedPeriod) return false;
      return true;
    });
  }, [categoryFilteredTrades, selectedPeriod]);

  // Filter specifically for Month Selection
  const monthFilteredTrades = useMemo(() => {
    return periodFilteredTrades.filter((t) => {
      if (!selectedMonth || !t.timestamp) return true;
      const d = new Date(t.timestamp * 1000);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return mKey === selectedMonth;
    });
  }, [periodFilteredTrades, selectedMonth]);

  // Filter specifically for Day Selection
  const dayFilteredTrades = useMemo(() => {
    return monthFilteredTrades.filter((t) => {
      if (!selectedDay || !t.timestamp) return true;
      const d = new Date(t.timestamp * 1000);
      const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return dKey === selectedDay;
    });
  }, [monthFilteredTrades, selectedDay]);

  // Final filtered list of trades matching ALL current drill-downs
  const activeDetailTrades = useMemo(() => {
    return dayFilteredTrades.filter((t) => {
      if (!selectedSlot || !t.timestamp) return true;
      const slot = getTradeSlot(t.timestamp, selectedPeriod);
      return slot.key === selectedSlot.key;
    });
  }, [dayFilteredTrades, selectedSlot, selectedPeriod]);

  // Active selection summary stats banner
  const activeBannerStats = useMemo(() => {
    let totalVolume = 0;
    let buys = 0;
    let sells = 0;

    // Use current level's filtered list
    const list =
      viewLevel === "trades"
        ? activeDetailTrades
        : viewLevel === "slots"
          ? dayFilteredTrades
          : viewLevel === "days"
            ? monthFilteredTrades
            : viewLevel === "months"
              ? periodFilteredTrades
              : viewLevel === "periods"
                ? categoryFilteredTrades
                : filteredTrades;

    list.forEach((t) => {
      totalVolume += (t.size ?? 0) * (t.price ?? 0);
      if (t.side === "BUY") buys++;
      if (t.side === "SELL") sells++;
    });

    const totalTrades = list.length;
    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
    const buyRatio = totalTrades > 0 ? (buys / totalTrades) * 100 : 0;

    return {
      totalVolume,
      totalTrades,
      avgTradeSize,
      buyRatio,
    };
  }, [
    viewLevel,
    filteredTrades,
    categoryFilteredTrades,
    periodFilteredTrades,
    monthFilteredTrades,
    dayFilteredTrades,
    activeDetailTrades,
  ]);

  // Groupings by Month for Level 3
  const monthsData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number }>();
    periodFilteredTrades.forEach((t) => {
      if (!t.timestamp) return;
      const d = new Date(t.timestamp * 1000);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const vol = (t.size ?? 0) * (t.price ?? 0);
      const current = map.get(mKey) ?? { count: 0, volume: 0 };
      map.set(mKey, {
        count: current.count + 1,
        volume: current.volume + vol,
      });
    });
    return Array.from(map.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [periodFilteredTrades]);

  // Groupings by Day for Level 4
  const daysData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number }>();
    monthFilteredTrades.forEach((t) => {
      if (!t.timestamp) return;
      const d = new Date(t.timestamp * 1000);
      const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const vol = (t.size ?? 0) * (t.price ?? 0);
      const current = map.get(dKey) ?? { count: 0, volume: 0 };
      map.set(dKey, {
        count: current.count + 1,
        volume: current.volume + vol,
      });
    });
    return Array.from(map.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [monthFilteredTrades]);

  // Groupings by Time Slots for Level 5
  const slotsData = useMemo(() => {
    const map = new Map<string, { label: string; count: number; volume: number; slot: TimeSlot }>();
    dayFilteredTrades.forEach((t) => {
      if (!t.timestamp) return;
      const slot = getTradeSlot(t.timestamp, selectedPeriod);
      const vol = (t.size ?? 0) * (t.price ?? 0);
      const current = map.get(slot.key) ?? { label: slot.label, count: 0, volume: 0, slot };
      map.set(slot.key, {
        label: slot.label,
        count: current.count + 1,
        volume: current.volume + vol,
        slot,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.slot.key.localeCompare(b.slot.key));
  }, [dayFilteredTrades, selectedPeriod]);

  // Paginated detail trades for Level 6
  const totalPages = Math.max(1, Math.ceil(activeDetailTrades.length / PAGE_SIZE));
  const paginatedTrades = useMemo(() => {
    return activeDetailTrades.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [activeDetailTrades, currentPage]);

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

  // Consolidated JSON download builder
  const handleExport = useCallback(() => {
    let tradesToExport: Trade[] = [];
    let exportLabel = "";

    if (viewLevel === "months") {
      if (selectedMonths.size > 0) {
        tradesToExport = periodFilteredTrades.filter((t) => {
          if (!t.timestamp) return false;
          const d = new Date(t.timestamp * 1000);
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return selectedMonths.has(mKey);
        });
        exportLabel = `${selectedAsset.toLowerCase()}-${selectedMonths.size}-months`;
      } else {
        tradesToExport = periodFilteredTrades;
        exportLabel = `${selectedAsset.toLowerCase()}-all-months`;
      }
    } else if (viewLevel === "days") {
      if (selectedDays.size > 0) {
        tradesToExport = monthFilteredTrades.filter((t) => {
          if (!t.timestamp) return false;
          const d = new Date(t.timestamp * 1000);
          const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return selectedDays.has(dKey);
        });
        exportLabel = `${selectedAsset.toLowerCase()}-${selectedMonth}-${selectedDays.size}-days`;
      } else {
        tradesToExport = monthFilteredTrades;
        exportLabel = `${selectedAsset.toLowerCase()}-${selectedMonth}-all-days`;
      }
    } else if (viewLevel === "slots") {
      if (selectedSlots.size > 0) {
        tradesToExport = dayFilteredTrades.filter((t) => {
          if (!t.timestamp) return false;
          const slot = getTradeSlot(t.timestamp, selectedPeriod);
          const slotKey = `${selectedDay}_${slot.key}`;
          return selectedSlots.has(slotKey);
        });
        exportLabel = `${selectedAsset.toLowerCase()}-${selectedDay}-${selectedSlots.size}-slots`;
      } else {
        tradesToExport = dayFilteredTrades;
        exportLabel = `${selectedAsset.toLowerCase()}-${selectedDay}-all-slots`;
      }
    } else if (viewLevel === "trades") {
      tradesToExport = activeDetailTrades;
      exportLabel = `${selectedAsset.toLowerCase()}-${selectedDay}-${selectedSlot?.key || "slot"}`;
    } else {
      // Assets / Periods Level
      tradesToExport = filteredTrades;
      exportLabel = `${selectedAsset.toLowerCase()}-export`;
    }

    const exportData = {
      user: userAddress,
      metadata: {
        asset: selectedAsset,
        period: selectedPeriod,
        month: selectedMonth,
        day: selectedDay,
        slot: selectedSlot?.label,
        level: viewLevel,
        exportedCount: tradesToExport.length,
        exportedAt: new Date().toISOString(),
      },
      trades: tradesToExport,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${exportLabel}-${userAddress.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    viewLevel,
    userAddress,
    selectedAsset,
    selectedPeriod,
    selectedMonth,
    selectedDay,
    selectedSlot,
    selectedMonths,
    selectedDays,
    selectedSlots,
    filteredTrades,
    periodFilteredTrades,
    monthFilteredTrades,
    dayFilteredTrades,
    activeDetailTrades,
  ]);

  // Navigate directly using breadcrumbs
  const navigateToLevel = (level: ViewLevel) => {
    setCurrentPage(1);
    setViewLevel(level);
    if (level === "assets") {
      setSelectedAsset("ALL");
      setSelectedPeriod("ALL");
      setSelectedMonth(null);
      setSelectedDay(null);
      setSelectedSlot(null);
      setSelectedMonths(new Set());
      setSelectedDays(new Set());
      setSelectedSlots(new Set());
    } else if (level === "periods") {
      setSelectedPeriod("ALL");
      setSelectedMonth(null);
      setSelectedDay(null);
      setSelectedSlot(null);
      setSelectedMonths(new Set());
      setSelectedDays(new Set());
      setSelectedSlots(new Set());
    } else if (level === "months") {
      setSelectedMonth(null);
      setSelectedDay(null);
      setSelectedSlot(null);
      setSelectedMonths(new Set());
      setSelectedDays(new Set());
      setSelectedSlots(new Set());
    } else if (level === "days") {
      setSelectedDay(null);
      setSelectedSlot(null);
      setSelectedDays(new Set());
      setSelectedSlots(new Set());
    } else if (level === "slots") {
      setSelectedSlot(null);
      setSelectedSlots(new Set());
    }
  };

  const handleAssetClick = (asset: AssetCategory) => {
    setSelectedAsset(asset);
    if (asset === "ALL" || asset === "GENERAL") {
      setSelectedPeriod("GENERAL");
      setViewLevel("months");
    } else {
      setViewLevel("periods");
    }
  };

  const handlePeriodClick = (pd: PeriodDuration) => {
    setSelectedPeriod(pd);
    setViewLevel("months");
  };

  const handleMonthClick = (mKey: string) => {
    setSelectedMonth(mKey);
    setViewLevel("days");
  };

  const handleDayClick = (dKey: string) => {
    setSelectedDay(dKey);
    setViewLevel("slots");
  };

  const handleSlotClick = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setViewLevel("trades");
  };

  // Selection toggle callbacks
  const toggleMonthSelection = (mKey: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(mKey)) next.delete(mKey);
      else next.add(mKey);
      return next;
    });
  };

  const toggleAllMonths = () => {
    const allKeys = monthsData.map((m) => m.key);
    const allSelected = allKeys.every((k) => selectedMonths.has(k));
    if (allSelected) {
      setSelectedMonths(new Set());
    } else {
      setSelectedMonths(new Set(allKeys));
    }
  };

  const toggleDaySelection = (dKey: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dKey)) next.delete(dKey);
      else next.add(dKey);
      return next;
    });
  };

  const toggleAllDays = () => {
    const allKeys = daysData.map((d) => d.key);
    const allSelected = allKeys.every((k) => selectedDays.has(k));
    if (allSelected) {
      setSelectedDays(new Set());
    } else {
      setSelectedDays(new Set(allKeys));
    }
  };

  const toggleSlotSelection = (slotKey: string) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slotKey)) next.delete(slotKey);
      else next.add(slotKey);
      return next;
    });
  };

  const toggleAllSlots = () => {
    const allKeys = slotsData.map((s) => `${selectedDay}_${s.slot.key}`);
    const allSelected = allKeys.every((k) => selectedSlots.has(k));
    if (allSelected) {
      setSelectedSlots(new Set());
    } else {
      setSelectedSlots(new Set(allKeys));
    }
  };

  // Calculated exports button labeling
  const exportButtonText = useMemo(() => {
    if (viewLevel === "months") {
      return selectedMonths.size > 0
        ? `Download JSON (${selectedMonths.size} Month(s))`
        : "Download JSON (All Months)";
    }
    if (viewLevel === "days") {
      return selectedDays.size > 0
        ? `Download JSON (${selectedDays.size} Day(s))`
        : "Download JSON (All Days)";
    }
    if (viewLevel === "slots") {
      return selectedSlots.size > 0
        ? `Download JSON (${selectedSlots.size} Slot(s))`
        : "Download JSON (All Slots)";
    }
    return "Download JSON";
  }, [viewLevel, selectedMonths, selectedDays, selectedSlots]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb path navigation */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted select-none border-b border-border/40 pb-2">
        <button
          onClick={() => navigateToLevel("assets")}
          className="hover:text-foreground transition-colors font-medium cursor-pointer"
        >
          All Categories
        </button>
        {selectedAsset !== "ALL" && (
          <>
            <span className="text-zinc-600">/</span>
            <button
              onClick={() =>
                navigateToLevel(selectedAsset === "GENERAL" ? "months" : "periods")
              }
              className="hover:text-foreground transition-colors font-medium text-accent cursor-pointer"
            >
              {selectedAsset}
            </button>
          </>
        )}
        {selectedPeriod !== "ALL" && selectedAsset !== "GENERAL" && (
          <>
            <span className="text-zinc-600">/</span>
            <button
              onClick={() => navigateToLevel("months")}
              className="hover:text-foreground transition-colors font-medium text-purple-400 cursor-pointer"
            >
              {selectedPeriod} Markets
            </button>
          </>
        )}
        {selectedMonth && (
          <>
            <span className="text-zinc-600">/</span>
            <button
              onClick={() => navigateToLevel("days")}
              className="hover:text-foreground transition-colors font-medium cursor-pointer"
            >
              {formatHumanMonth(selectedMonth)}
            </button>
          </>
        )}
        {selectedDay && (
          <>
            <span className="text-zinc-600">/</span>
            <button
              onClick={() => navigateToLevel("slots")}
              className="hover:text-foreground transition-colors font-medium cursor-pointer"
            >
              {formatHumanDate(selectedDay)}
            </button>
          </>
        )}
        {selectedSlot && (
          <>
            <span className="text-zinc-600">/</span>
            <span className="text-foreground font-semibold">{selectedSlot.label}</span>
          </>
        )}
      </div>

      {/* Stats Summary Banner for current filter state */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card/45 p-4.5 sm:grid-cols-4 shadow-sm">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
            Filtered Volume
          </span>
          <p className="text-lg font-mono font-bold tabular-nums text-foreground mt-0.5">
            {formatUsd(activeBannerStats.totalVolume)}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
            Filtered Trades
          </span>
          <p className="text-lg font-mono font-bold tabular-nums text-foreground mt-0.5">
            {activeBannerStats.totalTrades.toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
            Avg. Size
          </span>
          <p className="text-lg font-mono font-bold tabular-nums text-foreground mt-0.5">
            {formatUsd(activeBannerStats.avgTradeSize)}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
            Buy Ratio
          </span>
          <p className="text-lg font-mono font-bold tabular-nums text-foreground mt-0.5">
            {activeBannerStats.buyRatio.toFixed(1)}% Buy
          </p>
        </div>
      </div>

      {/* Global input controls and pagination hooks */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/25 p-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Search active selection…"
            value={marketFilter}
            onChange={(e) => {
              setMarketFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent w-full sm:w-56 cursor-text"
          />

          <div className="flex w-full sm:w-auto gap-2">
            <select
              value={sideFilter}
              onChange={(e) => {
                setSideFilter(e.target.value as Side);
                setCurrentPage(1);
              }}
              className="rounded border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Sides</option>
              <option value="BUY">Buy Only</option>
              <option value="SELL">Sell Only</option>
            </select>
          </div>

          <div className="flex w-full sm:w-auto items-center gap-2">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => {
                setDateStart(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent cursor-pointer"
            />
            <span className="text-[10px] text-muted font-mono shrink-0">to</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => {
                setDateEnd(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="flex-1 sm:flex-none rounded bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {loading ? "Loading..." : "Load 5k More"}
            </button>
          )}

          {/* Contextual Export Button (available from Months level and beyond) */}
          {["months", "days", "slots", "trades"].includes(viewLevel) && (
            <button
              onClick={handleExport}
              className="flex-1 sm:flex-none rounded bg-card border border-border px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-card-hover transition-colors cursor-pointer"
            >
              {exportButtonText}
            </button>
          )}
        </div>
      </div>

      {/* PROGRESSIVE VIEWS */}

      {/* LEVEL 1: ASSETS VIEW */}
      {viewLevel === "assets" && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Select Asset Market
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(["ALL", "BTC", "ETH", "SOL", "XRP", "GENERAL"] as AssetCategory[]).map((cat) => {
              const stats = categoryStats[cat];
              return (
                <button
                  key={cat}
                  onClick={() => handleAssetClick(cat)}
                  className="flex flex-col rounded-xl border border-border bg-card/60 p-4 text-left hover:bg-card-hover hover:border-muted transition-all duration-200 group cursor-pointer"
                >
                  <span className="text-xs font-bold tracking-wider text-muted group-hover:text-accent transition-colors cursor-pointer">
                    {cat}
                  </span>
                  <span className="mt-3 text-2xl font-mono font-bold tabular-nums text-foreground cursor-pointer">
                    {stats.count.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-mono text-muted tabular-nums mt-0.5 cursor-pointer">
                    {formatUsdCompact(stats.volume)} Vol
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LEVEL 2: PERIODS VIEW */}
      {viewLevel === "periods" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateToLevel("assets")}
              className="text-xs text-accent hover:underline cursor-pointer font-medium"
            >
              ← Back
            </button>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted select-none">
              Select Period Duration for {selectedAsset}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {([
              { id: "ALL", label: "All Durations" },
              { id: "5m", label: "5m Markets" },
              { id: "15m", label: "15m Markets" },
              { id: "1hr", label: "1hr Markets" },
              { id: "GENERAL", label: "Other prediction" },
            ] as { id: PeriodDuration; label: string }[]).map((pd) => {
              return (
                <button
                  key={pd.id}
                  onClick={() => handlePeriodClick(pd.id)}
                  className="flex flex-col rounded-xl border border-border bg-card/60 p-4 text-left hover:bg-card-hover hover:border-muted transition-all duration-200 cursor-pointer"
                >
                  <span className="text-xs font-bold text-foreground cursor-pointer">{pd.label}</span>
                  <span className="text-[10px] text-muted mt-2 cursor-pointer">
                    Click to drill down into months
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LEVEL 3: MONTHS GRID */}
      {viewLevel === "months" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  navigateToLevel(selectedAsset === "GENERAL" ? "assets" : "periods")
                }
                className="text-xs text-accent hover:underline cursor-pointer font-medium"
              >
                ← Back
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted select-none">
                Select Month
              </h3>
            </div>

            {monthsData.length > 0 && (
              <button
                onClick={toggleAllMonths}
                className="rounded border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-card-hover cursor-pointer select-none transition-colors"
              >
                {monthsData.every((m) => selectedMonths.has(m.key))
                  ? "Deselect All"
                  : "Select All"}
              </button>
            )}
          </div>

          {monthsData.length === 0 ? (
            <p className="text-xs text-muted py-4 select-none">
              No active months found for this category.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {monthsData.map((m) => {
                const isSelected = selectedMonths.has(m.key);
                return (
                  <div key={m.key} className="relative group select-none">
                    {/* Selection Checkbox */}
                    <div
                      className="absolute top-3.5 right-3.5 z-10 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMonthSelection(m.key)}
                        className="h-4.5 w-4.5 rounded border-border bg-zinc-900 text-accent outline-none cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={() => handleMonthClick(m.key)}
                      className={`flex flex-col w-full rounded-xl border p-4 text-left transition-all duration-200 font-mono cursor-pointer ${
                        isSelected
                          ? "border-accent bg-accent/5 shadow-md shadow-accent/5"
                          : "border-border bg-card/60 hover:bg-card-hover hover:border-muted"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground cursor-pointer">
                        {formatHumanMonth(m.key)}
                      </span>
                      <span className="text-lg font-bold text-accent mt-2 cursor-pointer">
                        {m.count.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted cursor-pointer">
                        {formatUsdCompact(m.volume)} Vol
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 4: DAYS GRID */}
      {viewLevel === "days" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateToLevel("months")}
                className="text-xs text-accent hover:underline cursor-pointer font-medium"
              >
                ← Back
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted select-none">
                Select Day
              </h3>
            </div>

            {daysData.length > 0 && (
              <button
                onClick={toggleAllDays}
                className="rounded border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-card-hover cursor-pointer select-none transition-colors"
              >
                {daysData.every((d) => selectedDays.has(d.key)) ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {daysData.length === 0 ? (
            <p className="text-xs text-muted py-4 select-none">
              No active days found for this month.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {daysData.map((d) => {
                const isSelected = selectedDays.has(d.key);
                return (
                  <div key={d.key} className="relative group select-none">
                    {/* Selection Checkbox */}
                    <div
                      className="absolute top-3.5 right-3.5 z-10 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDaySelection(d.key)}
                        className="h-4.5 w-4.5 rounded border-border bg-zinc-900 text-accent outline-none cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={() => handleDayClick(d.key)}
                      className={`flex flex-col w-full rounded-xl border p-4 text-left transition-all duration-200 font-mono cursor-pointer ${
                        isSelected
                          ? "border-accent bg-accent/5 shadow-md shadow-accent/5"
                          : "border-border bg-card/60 hover:bg-card-hover hover:border-muted"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground cursor-pointer">
                        {formatHumanDate(d.key)}
                      </span>
                      <span className="text-lg font-bold text-accent mt-2 cursor-pointer">
                        {d.count.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted cursor-pointer">
                        {formatUsdCompact(d.volume)} Vol
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 5: TIME SLOTS */}
      {viewLevel === "slots" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateToLevel("days")}
                className="text-xs text-accent hover:underline cursor-pointer font-medium"
              >
                ← Back
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted select-none">
                Select Time Bracket
              </h3>
            </div>

            {slotsData.length > 0 && (
              <button
                onClick={toggleAllSlots}
                className="rounded border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-card-hover cursor-pointer select-none transition-colors"
              >
                {slotsData.every((s) => selectedSlots.has(`${selectedDay}_${s.slot.key}`))
                  ? "Deselect All"
                  : "Select All"}
              </button>
            )}
          </div>

          {slotsData.length === 0 ? (
            <p className="text-xs text-muted py-4 select-none">No slots active on this day.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slotsData.map((s) => {
                const itemKey = `${selectedDay}_${s.slot.key}`;
                const isSelected = selectedSlots.has(itemKey);
                return (
                  <div key={s.slot.key} className="relative group select-none flex items-center">
                    {/* Selection Checkbox (aligned left) */}
                    <div
                      className="pl-4 pr-1.5 z-10 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSlotSelection(itemKey)}
                        className="h-4.5 w-4.5 rounded border-border bg-zinc-900 text-accent outline-none cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={() => handleSlotClick(s.slot)}
                      className={`flex flex-1 items-center justify-between rounded-xl border p-4 hover:bg-card-hover transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-accent bg-accent/5 shadow-md shadow-accent/5"
                          : "border-border bg-card/60 hover:border-muted"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground font-mono cursor-pointer">
                        {s.label}
                      </span>
                      <div className="text-right font-mono cursor-pointer">
                        <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent cursor-pointer">
                          {s.count} trades
                        </span>
                        <p className="text-[10px] text-muted mt-1 cursor-pointer">
                          {formatUsdCompact(s.volume)}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 6: TRADES TABLE LOG */}
      {viewLevel === "trades" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted select-none">
              Page {currentPage} of {totalPages} (showing {activeDetailTrades.length} trades in slot)
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded bg-card border border-border px-3 py-1 text-xs disabled:opacity-30 hover:bg-card-hover transition-colors cursor-pointer"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded bg-card border border-border px-3 py-1 text-xs disabled:opacity-30 hover:bg-card-hover transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs select-text">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wider text-muted border-b border-border/40 bg-card/40">
                    <th className="pl-4 pr-3 py-2.5 font-medium select-none">Time (Local)</th>
                    <th className="hidden sm:table-cell px-3 py-2.5 font-medium select-none">
                      Market
                    </th>
                    <th className="px-3 py-2.5 font-medium select-none">Side</th>
                    <th className="px-3 py-2.5 font-medium text-right select-none">Shares</th>
                    <th className="hidden sm:table-cell px-3 py-2.5 font-medium text-right select-none">
                      Price
                    </th>
                    <th className="pr-4 pl-3 py-2.5 font-medium text-right select-none">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrades.map((trade, i) => {
                    const isBuy = trade.side === "BUY";
                    return (
                      <tr
                        key={trade.transactionHash ?? i}
                        className="border-b border-border/25 hover:bg-card-hover/20 transition-colors"
                      >
                        <td className="pl-4 pr-3 py-2.5 text-muted font-mono tabular-nums whitespace-nowrap text-[11px] sm:text-xs">
                          {trade.timestamp ? formatDateTime(trade.timestamp) : "-"}
                        </td>
                        <td className="hidden sm:table-cell px-3 py-2.5 max-w-[280px] truncate text-foreground font-medium">
                          {trade.title ?? "Unknown Market"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              isBuy ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                            }`}
                          >
                            {trade.side ?? "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[11px] sm:text-xs">
                          {trade.size?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) ?? "-"}
                        </td>
                        <td className="hidden sm:table-cell px-3 py-2.5 text-right font-mono tabular-nums">
                          {trade.price != null ? `${(trade.price * 100).toFixed(1)}¢` : "-"}
                        </td>
                        <td className="pr-4 pl-3 py-2.5 text-right font-mono font-bold tabular-nums text-foreground text-[11px] sm:text-xs">
                          {trade.size != null && trade.price != null
                            ? formatUsd(trade.size * trade.price)
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
