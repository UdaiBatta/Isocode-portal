import { inr } from "@/lib/format";
import { cx } from "@/utils/cx";

export function Money({ paise, prominent = false }: { paise: number; prominent?: boolean }) {
  return <span className={cx("tabular-nums", prominent ? "ledger-type ledger-amount" : "text-headline-medium")}>{inr(paise)}</span>;
}
