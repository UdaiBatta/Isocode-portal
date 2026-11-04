import { cx } from "@/utils/cx";
import { inr } from "@/lib/format";
import type { AgeingRow } from "@/lib/types";

type Amounts = Pick<AgeingRow, "notDue" | "d1_30" | "d31_60" | "d61_90" | "d90p">;

const buckets = (row: Amounts) => [
  ["Not due", row.notDue, "bg-chart-3"],
  ["1–30 days", row.d1_30, "bg-chart-2/40"],
  ["31–60 days", row.d31_60, "bg-chart-2/70"],
  ["61–90 days", row.d61_90, "bg-chart-2"],
  ["90+ days", row.d90p, "bg-status-rose-text"],
] as const;

export function AgeingBar({ row, className }: { row: Amounts & { outstanding: number }; className?: string }) {
  return (
    <div role="img" aria-label={buckets(row).map(([label, amount]) => `${label}: ${inr(amount)}`).join("; ")} className={cx("flex h-2 w-full gap-px overflow-hidden rounded-full bg-background-secondary-default", className)}>
      {buckets(row).filter(([, amount]) => amount > 0).map(([label, amount, tone]) => (
        <span key={label} className={tone} style={{ width: `${row.outstanding ? amount / row.outstanding * 100 : 0}%` }} />
      ))}
    </div>
  );
}

// Where the money sits by age, for the rows on screen. Labels carry the values, so it reads without colour.
export function AgeingDistribution({ rows }: { rows: AgeingRow[] }) {
  const sum = (key: keyof Amounts | "outstanding") => rows.reduce((total, row) => total + row[key], 0);
  const totals = { notDue: sum("notDue"), d1_30: sum("d1_30"), d31_60: sum("d31_60"), d61_90: sum("d61_90"), d90p: sum("d90p"), outstanding: sum("outstanding") };
  return <section aria-labelledby="ageing-title">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="ageing-title" className="text-headline-medium">Ageing by value</h2><p className="text-body-regular tabular-nums text-text-secondary">{inr(totals.outstanding)} outstanding</p></div>
    <AgeingBar row={totals} className="h-3" />
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">{buckets(totals).map(([label, amount, tone]) => <div key={label} className="flex flex-col gap-1">
      <dt className="flex items-center gap-2 text-body-regular text-text-secondary"><span aria-hidden className={cx("size-2 shrink-0 rounded-full", tone)} />{label}</dt>
      <dd className="text-body-medium tabular-nums">{inr(amount)}</dd>
    </div>)}</dl>
  </section>;
}
