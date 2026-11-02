import { Skeleton } from "@/components/base/skeleton/skeleton";
import { PageShell } from "./PageShell";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function PageSkeleton({ language }: { language: Language }) {
  return (
    <PageShell className="flex min-h-dvh flex-col justify-center gap-8">
      <div aria-busy="true" role="status" aria-label={t(language, "common.loading")} className="flex flex-col gap-8">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </PageShell>
  );
}
