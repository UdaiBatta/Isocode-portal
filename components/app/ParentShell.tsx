import type { ReactNode } from "react";
import { RiBarChart2Line, RiGraduationCapLine, RiSettings4Line, RiUserLine, RiWallet3Line } from "@remixicon/react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoutButton } from "./LogoutButton";
import { StaffPageHeader } from "./StaffPage";
import { pt } from "@/lib/i18n/portal";
import { ORG } from "@/lib/config";
import { cx } from "@/utils/cx";
import type { Language } from "@/lib/types";

const tabs = [
  { key: "fees", path: "/dues", icon: RiWallet3Line, label: "portal.fees", short: "portal.feesShort" },
  { key: "academic", path: "/progress", icon: RiBarChart2Line, label: "portal.academic", short: "portal.academicShort" },
  { key: "course", path: "/course", icon: RiGraduationCapLine, label: "portal.course", short: "portal.courseShort" },
  { key: "student", path: "/student", icon: RiUserLine, label: "portal.student", short: "portal.studentShort" },
  { key: "settings", path: "/settings", icon: RiSettings4Line, label: "portal.settings", short: "portal.settings" },
] as const;

export const parentSectionClass = "flex flex-col gap-4 rounded-3xl border border-border-button-default p-4 md:p-5";

// The staff frame's look, drawn on the server: StaffShell's sidebar, drawer and icons would put /dues over its 200 KB script budget.
export function ParentShell({ language, active, family, selected, title, description, showLanguage = true, children }: {
  language: Language; active: (typeof tabs)[number]["key"]; family: { studentId: string; fullName: string }[]; selected: string;
  title: string; description: string; showLanguage?: boolean; children: ReactNode;
}) {
  const withStudent = (path: string, student = selected) => family.length > 1 ? `${path}?student=${encodeURIComponent(student)}` : path;
  const activePath = tabs.find((tab) => tab.key === active)!.path;
  return <div className="parent-surface min-h-dvh text-text-primary md:flex md:gap-6 md:p-6">
    <div className="hidden w-60 shrink-0 md:block"><aside className="sticky top-6 flex h-[calc(100dvh-48px)] flex-col gap-10 rounded-3xl bg-background-secondary-default p-5">
      <div><p className="text-headline-medium">{ORG.name}</p><p className="text-body-regular text-text-secondary">{ORG.city} · {pt(language, "portal.area")}</p></div>
      <nav aria-label={pt(language, "portal.nav")} className="flex flex-col gap-2">{tabs.map((tab) => <a key={tab.key} href={withStudent(tab.path)} aria-current={tab.key === active ? "page" : undefined} className={cx("flex items-center gap-2 rounded-2lg p-2", tab.key === active ? "bg-linear-to-b from-accent-500 to-accent-600 text-text-white shadow-nav-selected" : "text-text-secondary hover:bg-background-secondary-hover")}>
        <tab.icon aria-hidden className={cx("size-5 shrink-0", tab.key === active ? "text-text-white" : "text-foreground-icon-secondary")} /><span className="text-body-medium">{pt(language, tab.label)}</span>
      </a>)}</nav>
      <div className="mt-auto"><LogoutButton language={language} /></div>
    </aside></div>
    <main className="mx-auto flex w-full min-w-0 max-w-[880px] flex-col gap-6 px-4 pb-28 pt-5 md:px-0 md:py-3">
      <div className="flex items-center justify-between gap-3">
        {family.length > 1 ? <nav aria-label={pt(language, "portal.children")} className="flex min-w-0 flex-wrap gap-2">{family.map((child) => <a key={child.studentId} href={withStudent(activePath, child.studentId)} aria-current={child.studentId === selected ? "page" : undefined} className={cx("flex items-center rounded-full px-4 text-body-medium", child.studentId === selected ? "bg-background-secondary-default text-text-primary" : "text-text-secondary hover:bg-background-secondary-hover")}>{child.fullName}</a>)}</nav> : <p className="min-w-0 text-headline-medium">{family[0]?.fullName}</p>}
        {showLanguage ? <LanguageSwitcher language={language} /> : null}
      </div>
      <StaffPageHeader title={title} description={description} />
      {children}
    </main>
    <nav aria-label={pt(language, "portal.nav")} className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-separator-border bg-background-primary-default pb-[env(safe-area-inset-bottom)] md:hidden">{tabs.map((tab) => <a key={tab.key} href={withStudent(tab.path)} aria-current={tab.key === active ? "page" : undefined} className={cx("flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 text-caption-1-medium", tab.key === active ? "text-accent-600" : "text-text-secondary")}>
      <tab.icon aria-hidden className="size-5 shrink-0" /><span>{pt(language, tab.short)}</span>
    </a>)}</nav>
  </div>;
}

export function ParentDetails({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="divide-y divide-separator-border">{rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-6 py-3">
    <dt className="text-body-regular text-text-secondary">{label}</dt><dd className="min-w-0 text-end text-body-medium tabular-nums">{value}</dd>
  </div>)}</dl>;
}
