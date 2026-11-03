import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ParentDetails, ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { StaffFrame } from "@/components/app/StaffPage";
import { getFamily, getStudentInfo } from "@/lib/data/student";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { dateLabel, phoneLabel } from "@/lib/format";
import { pt } from "@/lib/i18n/portal";

export default async function Student({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const context = await getParentPageContext();
  const { language, today } = context;
  const state = previewState(query);
  if (state === "loading") return <PageSkeleton language={language} />;
  if (state === "empty") return <PageShell><EmptyState title={pt(language, "student.empty")} /></PageShell>;
  if (context.role !== "parent") redirect("/login");
  if (!context.consent) redirect("/consent");
  const selected = typeof query.student === "string" ? query.student : undefined;
  const [family, info] = await Promise.all([getFamily(selected), getStudentInfo(selected)]);
  return <ParentShell language={language} active="student" {...family} title={pt(language, "portal.student")} description={pt(language, "student.description")}>
    <StaffFrame><section className={parentSectionClass}>
      <ParentDetails rows={[
        [pt(language, "student.name"), <bdi key="name">{info.name}</bdi>],
        [pt(language, "student.code"), <bdi key="code">{info.code}</bdi>],
        [pt(language, "student.status"), pt(language, info.status === "active" ? "student.active" : "student.withdrawn")],
        [pt(language, "student.enrolled"), dateLabel(info.enrolledOn, language, today)],
        [pt(language, "student.guardianPhone"), <bdi key="phone">{phoneLabel(info.guardianPhone)}</bdi>],
        [pt(language, "student.language"), info.preferredLanguage === "hi" ? "हिंदी" : "English"],
      ]} />
      <p className="text-body-regular text-text-secondary">{pt(language, "student.correction")}</p>
    </section></StaffFrame>
  </ParentShell>;
}
