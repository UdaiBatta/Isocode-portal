import { EmptyState } from "./EmptyState";
import { MarksChart } from "./MarksChart";
import { dateLabel } from "@/lib/format";
import { pt } from "@/lib/i18n/portal";
import { cx } from "@/utils/cx";
import type { Language, ProgressVM } from "@/lib/types";

// Test scores and attendance side by side with the marks line below. Parents see it on /progress, and staff on a student's record.
export function ProgressPanels({ progress: { attendance, tests }, language, today, folio = false }: { progress: ProgressVM; language: Language; today: string; folio?: boolean }) {
  const recent = attendance.slice(0, 4);
  return attendance.length || tests.length ? <>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={cx(folio ? "ledger-folio" : "rounded-3xl border border-border-button-default bg-background-primary-default p-4 md:p-5", "flex flex-col gap-3")}>
          <h2 className="text-title-2-medium">{pt(language, "progress.tests")}</h2>
          {tests.length ? <ul className="divide-y divide-separator-border">{tests.map((test) => <li key={`${test.testDate}-${test.testName}`} className="flex items-center justify-between gap-4 py-3">
            <span className="flex min-w-0 flex-col gap-0.5"><bdi className="text-body-medium">{test.testName}</bdi><span className="text-body-regular text-text-secondary">{dateLabel(test.testDate, language, today)}</span></span>
            <bdi className="ledger-figure shrink-0">{test.score}/{test.maxScore}</bdi>
          </li>)}</ul> : <p className="text-body-regular text-text-secondary">{pt(language, "progress.noTests")}</p>}
        </section>
        <section className={cx(folio ? "ledger-folio" : "rounded-3xl border border-border-button-default bg-background-primary-default p-4 md:p-5", "flex flex-col gap-3")}>
          <h2 className="text-title-2-medium">{pt(language, "progress.attendance")}</h2>
          {recent.length > 1 ? <p className="text-body-medium">{pt(language, "progress.summary", { n: recent.length, attended: recent.reduce((sum, week) => sum + week.attended, 0), held: recent.reduce((sum, week) => sum + week.held, 0) })}</p> : null}
          {attendance.length ? <ul className="divide-y divide-separator-border">{attendance.map((week) => <li key={week.weekStart} className="flex items-center justify-between gap-3 py-2.5 text-body-regular">
            <span className="min-w-0">{pt(language, "progress.week", { date: dateLabel(week.weekStart, language, today) })}</span>
            <span className="flex shrink-0 items-center gap-3"><span aria-hidden className="ledger-tally">{Array.from({ length: week.held }, (_, index) => <span key={index} data-on={index < week.attended ? true : undefined} />)}</span><span className="tabular-nums">{pt(language, "progress.classes", { attended: week.attended, held: week.held })}</span></span>
          </li>)}</ul> : <p className="text-body-regular text-text-secondary">{pt(language, "progress.noAttendance")}</p>}
        </section>
      </div>
      {tests.length > 1 ? <section className={cx(folio && "ledger-folio", "flex flex-col gap-1")}>
        <h2 className="text-title-2-medium">{pt(language, "progress.marks")}</h2>
        <p className="text-body-regular text-text-secondary">{pt(language, "progress.marksNote")}</p>
        <MarksChart tests={tests} label={pt(language, "progress.marks")} formatDate={(date) => dateLabel(date, language, today)} />
      </section> : null}
    </> : <EmptyState title={pt(language, "progress.empty")} />;
}
