import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

export function PageShell({ children, variant = "parent", className }: { children: ReactNode; variant?: "parent" | "staff"; className?: string }) {
  return <main className={cx("mx-auto w-full", variant === "parent" ? "parent-surface max-w-[480px] px-5 py-10" : "max-w-[1200px] p-6", className)}>{children}</main>;
}
