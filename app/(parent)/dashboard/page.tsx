import { DuesStatus, feeTotals } from "@/components/app/DuesStatus";
import { GlanceRow, ParentShell, parentSectionClass, withStudent } from "@/components/app/ParentShell";
import { getDues } from "@/lib/data/dues";
import { parentPage } from "@/lib/data/parent-page";
import { getProgress } from "@/lib/data/progress";
import { getReceipts } from "@/lib/data/receipts";
import { getStudentInfo } from "@/lib/data/student";
import { dateLabel, inr } from "@/lib/format";
import { pt } from "@/lib/i18n/portal";
import type { SearchParams } from "@/lib/preview";

export default async function ParentHome({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { language, today, student, state, shell } = await parentPage(await searchParams);
  if (state) return <ParentShell {...shell} active="home" emptyTitle={pt(language, "home.empty")} />;
  const [view, progress, receipts, info] = await Promise.all([getDues(student), getProgress(student), getReceipts(student), getStudentInfo(student)]);
  const link = (path: string) => withStudent(path, shell.selected, shell.family);
  const { total, paid, remaining } = feeTotals(view);
  const recent = progress.attendance.slice(0, 4);
  const latestTest = progress.tests[0];
  const latestReceipt = receipts[0];
  return <ParentShell {...shell} active="home" showName={false} title={info.name} description={`${info.batch} · ${info.centre}`}>
    <DuesStatus view={view} language={language} today={today} />
    <section className={parentSectionClass}>
      <h2 className="text-title-2-medium">{pt(language, "home.glance")}</h2>
      <ul className="divide-y divide-separator-border">
        {view.mode !== "withdrawn" ? <GlanceRow href={link("/dues")} label={pt(language, "portal.fees")} figure={inr(remaining)} value={pt(language, "home.fees", { paid: inr(paid), total: inr(total), remaining: inr(remaining) })} /> : null}
        <GlanceRow href={link("/receipts")} label={pt(language, "home.latestReceipt")} figure={latestReceipt ? dateLabel(latestReceipt.issuedOn, language, today) : undefined} value={latestReceipt ? <>{inr(latestReceipt.amount)} · {dateLabel(latestReceipt.issuedOn, language, today)}</> : pt(language, "invoice.none")} />
        <GlanceRow href={link("/progress")} label={pt(language, "progress.attendance")} figure={recent.length ? `${recent.reduce((sum, week) => sum + week.attended, 0)}/${recent.reduce((sum, week) => sum + week.held, 0)}` : undefined} value={recent.length ? pt(language, "home.attendance", { attended: recent.reduce((sum, week) => sum + week.attended, 0), held: recent.reduce((sum, week) => sum + week.held, 0), n: recent.length }) : pt(language, "progress.noAttendance")} />
        <GlanceRow href={link("/progress")} label={pt(language, "home.latestTest")} figure={latestTest ? `${latestTest.score}/${latestTest.maxScore}` : undefined} value={latestTest ? <><bdi>{latestTest.testName}</bdi> · {latestTest.score}/{latestTest.maxScore}</> : pt(language, "progress.noTests")} />
        <GlanceRow href={link("/course")} label={pt(language, "portal.course")} value={<bdi>{info.batch} · {info.centre}</bdi>} />
      </ul>
    </section>
  </ParentShell>;
}
