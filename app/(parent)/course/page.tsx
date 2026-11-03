import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ParentDetails, ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { StaffFrame } from "@/components/app/StaffPage";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getFamily, getStudentInfo } from "@/lib/data/student";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { dateLabel } from "@/lib/format";
import { pt } from "@/lib/i18n/portal";

export default async function Course({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const context = await getParentPageContext();
  const { language } = context;
  const state = previewState(query);
  if (state === "loading") return <PageSkeleton language={language} />;
  if (state === "empty") return <PageShell><EmptyState title={pt(language, "course.empty")} /></PageShell>;
  if (context.role !== "parent") redirect("/login");
  if (!context.consent) redirect("/consent");
  const selected = typeof query.student === "string" ? query.student : undefined;
  const [family, info] = await Promise.all([getFamily(selected), getStudentInfo(selected)]);
  const { course } = info;
  return <ParentShell language={language} active="course" {...family} title={pt(language, "portal.course")} description={pt(language, "course.description")}>
    <StaffFrame><section className={parentSectionClass}>
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
    </section></StaffFrame>
  </ParentShell>;
}
