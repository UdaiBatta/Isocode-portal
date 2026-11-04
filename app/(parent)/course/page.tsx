import { ParentDetails, ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { LinkButton } from "@/components/base/buttons/link-button";
import { parentPage } from "@/lib/data/parent-page";
import { getStudentInfo } from "@/lib/data/student";
import { dateLabel } from "@/lib/format";
import { pt } from "@/lib/i18n/portal";
import type { SearchParams } from "@/lib/preview";

export default async function Course({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { language, student, state, shell } = await parentPage(await searchParams);
  const header = { active: "course", title: pt(language, "portal.course"), description: pt(language, "course.description"), emptyTitle: pt(language, "course.empty") } as const;
  if (state) return <ParentShell {...shell} {...header} />;
  const info = await getStudentInfo(student);
  const { course } = info;
  return <ParentShell {...shell} {...header}>
    <section className={parentSectionClass}>
      <ParentDetails rows={[
        [pt(language, "course.name"), pt(language, course.exam === "JEE" ? "course.jee" : "course.neet")],
        [pt(language, "course.examYear"), course.examYear],
        [pt(language, "course.batch"), <bdi key="batch">{info.batch}</bdi>],
        [pt(language, "course.timing"), pt(language, course.timing === "Morning" ? "course.morning" : "course.evening")],
        [pt(language, "course.centre"), <bdi key="centre">{info.centre}</bdi>],
        [pt(language, "course.session"), `${dateLabel(course.sessionStart, language, "")} – ${dateLabel(course.sessionEnd, language, "")}`],
        [pt(language, "course.instalments"), course.instalments],
      ]} />
      <div><LinkButton href="/refund-policy" variant="secondary">{pt(language, "portal.refundPolicy")}</LinkButton></div>
    </section>
  </ParentShell>;
}
