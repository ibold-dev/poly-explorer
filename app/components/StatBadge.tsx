interface StatBadgeProps {
  label: string;
  value: string;
  profit?: boolean | null;
  loss?: boolean | null;
}

export default function StatBadge({ label, value, profit, loss }: StatBadgeProps) {
  const color = profit
    ? "text-profit"
    : loss
      ? "text-loss"
      : "text-foreground";

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className={`text-sm font-mono font-medium tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}
