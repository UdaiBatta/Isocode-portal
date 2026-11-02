import { inr } from "@/lib/format";
import type { AgeingRow } from "@/lib/types";

export function AgeingBar({ row }: { row: AgeingRow }) {
  const buckets = [
    ["Not due", row.notDue, "bg-background-tertiary-default"],
    ["1–30 days", row.d1_30, "bg-status-cyan-background"],
    ["31–60 days", row.d31_60, "bg-status-yellow-background"],
    ["61–90 days", row.d61_90, "bg-status-rose-background border-s-2 border-separator-border"],
    ["90+ days", row.d90p, "bg-status-rose-text"],
  ] as const;
  return (
    <div role="img" aria-label={buckets.map(([label, amount]) => `${label}: ${inr(amount)}`).join("; ")} className="flex h-2 w-full overflow-hidden rounded-full bg-background-secondary-default">
      {buckets.filter(([, amount]) => amount > 0).map(([label, amount, className]) => (
        <span key={label} className={className} style={{ width: `${row.outstanding ? amount / row.outstanding * 100 : 0}%` }} />
      ))}
    </div>
  );
}
