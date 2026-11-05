import { ParentShell } from "@/components/app/ParentShell";
import { ProgressPanels } from "@/components/app/ProgressPanels";
import { parentPage } from "@/lib/data/parent-page";
import { getProgress } from "@/lib/data/progress";
import { pt } from "@/lib/i18n/portal";
import type { SearchParams } from "@/lib/preview";

export default async function Progress({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { language, today, student, state, shell } = await parentPage(await searchParams);
  const header = { active: "academic", title: pt(language, "portal.academic"), description: pt(language, "progress.description"), emptyTitle: pt(language, "progress.empty") } as const;
  if (state) return <ParentShell {...shell} {...header} />;
  const progress = await getProgress(student);
  return <ParentShell {...shell} {...header} wide>
    <ProgressPanels progress={progress} language={language} today={today} folio />
  </ParentShell>;
}
