import { inr } from "@/lib/format";
import { cx } from "@/utils/cx";

export function Money({ paise, prominent = false }: { paise: number; prominent?: boolean }) {
  return <span className={cx("tabular-nums", prominent ? "text-display-3-semibold" : "text-headline-medium")}>{inr(paise)}</span>;
}
