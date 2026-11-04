import { EmptyState } from "@/components/app/EmptyState";
import { ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { parentPage } from "@/lib/data/parent-page";
import { getProgress } from "@/lib/data/progress";
import { dateLabel } from "@/lib/format";
import { pt } from "@/lib/i18n/portal";
import type { SearchParams } from "@/lib/preview";

export default async function Progress({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { language, today, student, state, shell } = await parentPage(await searchParams);
  const header = { active: "academic", title: pt(language, "portal.academic"), description: pt(language, "progress.description"), emptyTitle: pt(language, "progress.empty") } as const;
  if (state) return <ParentShell {...shell} {...header} />;
  const { attendance, tests } = await getProgress(student);
  const recent = attendance.slice(0, 4);
  return <ParentShell {...shell} {...header}>
    {attendance.length || tests.length ? <>
      <section className={parentSectionClass}>
        <h2 className="text-headline-medium">{pt(language, "progress.attendance")}</h2>
        {recent.length > 1 ? <p className="text-headline-regular">{pt(language, "progress.summary", { n: recent.length, attended: recent.reduce((sum, week) => sum + week.attended, 0), held: recent.reduce((sum, week) => sum + week.held, 0) })}</p> : null}
        {attendance.length ? <ul className="divide-y divide-separator-border">{attendance.map((week) => <li key={week.weekStart} className="flex flex-col gap-2 py-3">
          <span className="flex justify-between gap-4 text-body-regular"><span>{pt(language, "progress.week", { date: dateLabel(week.weekStart, language, today) })}</span><span className="shrink-0 tabular-nums">{pt(language, "progress.classes", { attended: week.attended, held: week.held })}</span></span>
          <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-border-button-default"><span className="block h-full rounded-full bg-accent-700" style={{ width: `${week.held ? week.attended / week.held * 100 : 0}%` }} /></span>
        </li>)}</ul> : <p className="text-body-regular text-text-secondary">{pt(language, "progress.noAttendance")}</p>}
      </section>
      <section className={parentSectionClass}>
        <h2 className="text-headline-medium">{pt(language, "progress.tests")}</h2>
        {tests.length ? <ul className="divide-y divide-separator-border">{tests.map((test) => <li key={`${test.testDate}-${test.testName}`} className="flex items-center justify-between gap-4 py-3">
          <span className="flex min-w-0 flex-col gap-1"><bdi className="text-body-medium">{test.testName}</bdi><span className="text-body-regular text-text-secondary">{dateLabel(test.testDate, language, today)}</span></span>
          <bdi className="shrink-0 text-headline-medium tabular-nums">{test.score}/{test.maxScore}</bdi>
        </li>)}</ul> : <p className="text-body-regular text-text-secondary">{pt(language, "progress.noTests")}</p>}
      </section>
    </> : <EmptyState title={pt(language, "progress.empty")} />}
  </ParentShell>;
}
