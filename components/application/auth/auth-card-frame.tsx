import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/** The BoardUI AuthCard surface, separated from its optional example forms. */
export function AuthCardFrame({ title, description, className, children }: { title?: ReactNode; description?: ReactNode; className?: string; children: ReactNode }) {
  return <div className={cx("flex w-full max-w-[400px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8", className)}>
    {title === undefined ? children : <><div className="flex flex-col gap-1.5"><h1 className="text-title-2-medium text-text-primary">{title}</h1>{description ? <p className="text-body-regular text-text-secondary">{description}</p> : null}</div><div className="mt-8">{children}</div></>}
  </div>;
}
