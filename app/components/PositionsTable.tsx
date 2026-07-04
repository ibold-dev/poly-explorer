import type { CurrentPosition, ClosedPosition } from "polymarket-client-ts";
import Link from "next/link";
import { formatUsd, formatPnl } from "../lib/format";

interface PositionsTableProps {
  positions: CurrentPosition[];
  type: "current";
}

interface ClosedPositionsTableProps {
  positions: ClosedPosition[];
  type: "closed";
}

type Props = PositionsTableProps | ClosedPositionsTableProps;

export default function PositionsTable(props: Props) {
  if (props.positions.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted">
        No {props.type} positions found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="pb-2 pr-4 font-medium">Market</th>
            <th className="hidden sm:table-cell pb-2 pr-4 font-medium">Outcome</th>
            <th className="pb-2 pr-4 font-medium text-right">Size</th>
            <th className="hidden sm:table-cell pb-2 pr-4 font-medium text-right">Avg Price</th>
            {props.type === "current" && (
              <>
                <th className="pb-2 pr-4 font-medium text-right">Value</th>
                <th className="pb-2 pr-4 font-medium text-right">PnL</th>
              </>
            )}
            {props.type === "closed" && (
              <th className="pb-2 pr-4 font-medium text-right">Realized PnL</th>
            )}
          </tr>
        </thead>
        <tbody>
          {props.positions.map((pos, i) => (
            <tr key={pos.asset ?? i} className="border-b border-border/50">
              <td className="py-2 pr-4 max-w-[120px] sm:max-w-[200px]">
                <Link
                  href={`/markets/${pos.conditionId}`}
                  title={pos.title ?? "Unknown"}
                  className="text-accent hover:underline truncate block"
                >
                  {pos.title ?? "Unknown"}
                </Link>
              </td>
              <td className="hidden sm:table-cell py-2 pr-4 font-mono tabular-nums">
                {pos.outcome ?? "-"}
              </td>
              <td className="py-2 pr-4 text-right font-mono tabular-nums">
                {pos.totalBought?.toFixed(2) ?? "-"}
              </td>
              <td className="hidden sm:table-cell py-2 pr-4 text-right font-mono tabular-nums">
                {(pos.avgPrice * 100)?.toFixed(1) ?? "-"}¢
              </td>
              {props.type === "current" && (
                <>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums">
                    {formatUsd((pos as CurrentPosition).currentValue)}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right font-mono tabular-nums ${(pos as CurrentPosition).cashPnl > 0 ? "text-profit" : (pos as CurrentPosition).cashPnl < 0 ? "text-loss" : ""}`}
                  >
                    {formatPnl((pos as CurrentPosition).cashPnl)}
                  </td>
                </>
              )}
              {props.type === "closed" && (
                <td
                  className={`py-2 pr-4 text-right font-mono tabular-nums ${pos.realizedPnl > 0 ? "text-profit" : pos.realizedPnl < 0 ? "text-loss" : ""}`}
                >
                  {formatPnl(pos.realizedPnl)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
