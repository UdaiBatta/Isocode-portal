import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { LogoutButton } from "@/components/app/LogoutButton";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getProgress } from "@/lib/data/progress";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { dateLabel } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/progress";

export default async function Progress({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const context = await getParentPageContext();
  const { language, today } = context;
  const state = previewState(query);
  if (state === "loading") return <PageSkeleton language={language} />;
  if (state === "empty") return <PageShell><EmptyState title={pt(language, "progress.empty")} /></PageShell>;
  if (context.role !== "parent") redirect("/login");
  if (!context.consent) redirect("/consent");
  const selected = typeof query.student === "string" ? query.student : undefined;
  const { studentName, attendance, tests } = await getProgress(selected);
  const recent = attendance.slice(0, 4);
  return <PageShell className="flex flex-col gap-8">
    <header className="flex items-start justify-between gap-3"><div className="flex min-w-0 flex-col gap-1"><h1 className="text-title-1-medium">{pt(language, "progress.title")}</h1><p className="text-body-regular text-text-secondary">{studentName}</p></div><LanguageSwitcher language={language} /></header>
    {attendance.length || tests.length ? <>
      <section className="flex flex-col gap-3">
        <h2 className="text-headline-medium">{pt(language, "progress.attendance")}</h2>
        {recent.length > 1 ? <p className="text-headline-regular">{pt(language, "progress.summary", { n: recent.length, attended: recent.reduce((sum, week) => sum + week.attended, 0), held: recent.reduce((sum, week) => sum + week.held, 0) })}</p> : null}
        {attendance.length ? <ul className="divide-y divide-separator-border">{attendance.map((week) => <li key={week.weekStart} className="flex flex-col gap-2 py-3">
          <span className="flex justify-between gap-4 text-body-regular"><span>{pt(language, "progress.week", { date: dateLabel(week.weekStart, language, today) })}</span><span className="shrink-0 tabular-nums">{pt(language, "progress.classes", { attended: week.attended, held: week.held })}</span></span>
          <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-border-button-default"><span className="block h-full rounded-full bg-accent-500" style={{ width: `${week.held ? week.attended / week.held * 100 : 0}%` }} /></span>
        </li>)}</ul> : <p className="text-body-regular text-text-secondary">{pt(language, "progress.noAttendance")}</p>}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-headline-medium">{pt(language, "progress.tests")}</h2>
        {tests.length ? <ul className="divide-y divide-separator-border">{tests.map((test) => <li key={`${test.testDate}-${test.testName}`} className="flex items-center justify-between gap-4 py-3">
          <span className="flex min-w-0 flex-col gap-1"><bdi className="text-body-medium">{test.testName}</bdi><span className="text-body-regular text-text-secondary">{dateLabel(test.testDate, language, today)}</span></span>
          <bdi className="shrink-0 text-headline-medium tabular-nums">{test.score}/{test.maxScore}</bdi>
        </li>)}</ul> : <p className="text-body-regular text-text-secondary">{pt(language, "progress.noTests")}</p>}
      </section>
    </> : <EmptyState title={pt(language, "progress.empty")} />}
    <footer className="flex flex-wrap items-center gap-6"><LinkButton href={selected ? `/dues?student=${encodeURIComponent(selected)}` : "/dues"} variant="secondary">{t(language, "pay.backToDues")}</LinkButton><LogoutButton language={language} /></footer>
  </PageShell>;
}
