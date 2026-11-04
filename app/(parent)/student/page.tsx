import { ParentDetails, ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { parentPage } from "@/lib/data/parent-page";
import { getStudentInfo } from "@/lib/data/student";
import { dateLabel, phoneLabel } from "@/lib/format";
import { pt } from "@/lib/i18n/portal";
import type { SearchParams } from "@/lib/preview";

export default async function Student({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { language, today, student, state, shell } = await parentPage(await searchParams);
  const header = { active: "student", showName: false, title: pt(language, "portal.student"), description: pt(language, "student.description"), emptyTitle: pt(language, "student.empty") } as const;
  if (state) return <ParentShell {...shell} {...header} />;
  const info = await getStudentInfo(student);
  return <ParentShell {...shell} {...header}>
    <section className={parentSectionClass}>
      <ParentDetails rows={[
        [pt(language, "student.name"), <bdi key="name">{info.name}</bdi>],
        [pt(language, "student.code"), <bdi key="code">{info.code}</bdi>],
        [pt(language, "student.status"), pt(language, info.status === "active" ? "student.active" : "student.withdrawn")],
        [pt(language, "student.enrolled"), dateLabel(info.enrolledOn, language, today)],
        [pt(language, "student.guardianPhone"), <bdi key="phone">{phoneLabel(info.guardianPhone)}</bdi>],
        [pt(language, "student.language"), info.preferredLanguage === "hi" ? "हिंदी" : "English"],
      ]} />
      <p className="text-body-regular text-text-secondary">{pt(language, "student.correction")}</p>
    </section>
  </ParentShell>;
}
