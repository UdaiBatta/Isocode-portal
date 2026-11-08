import type { ComponentType, ReactNode } from "react";
import { Chip } from "@/components/base/badges/chip";
import { cx } from "@/utils/cx";

type Stat = { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>; label: string; value: ReactNode; delta: string; deltaColor: "lime" | "rose" | "neutral" };

export function StatCards({ stats, columns = 4, className }: { stats: Stat[]; columns?: 1 | 4; className?: string }) {
  return <div className={cx("grid w-full gap-4", columns === 1 ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-4", className)}>
    {stats.map((stat) => <section key={stat.label} className="flex min-h-[132px] min-w-0 flex-col items-start gap-3 rounded-2xl bg-background-secondary-default p-4">
      <span className="flex items-center rounded-md bg-stat-card-icon-background p-1.5"><stat.icon className="size-5 shrink-0 text-foreground-icon-primary" aria-hidden /></span>
      <div className="flex w-full flex-col gap-0.5">
        <p className="w-full text-body-medium text-text-secondary">{stat.label}</p>
        <div className="flex w-full flex-wrap items-center gap-2">
          <p className="text-title-1-medium whitespace-nowrap text-text-primary">{stat.value}</p>
          <Chip variant="bold" color={stat.deltaColor}>{stat.delta}</Chip>
        </div>
      </div>
    </section>)}
  </div>;
}
