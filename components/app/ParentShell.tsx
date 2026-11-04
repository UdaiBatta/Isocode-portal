import type { ReactNode } from "react";
import { RiArrowRightSLine, RiBarChart2Line, RiFileList3Line, RiGraduationCapLine, RiHomeLine, RiMoreLine, RiSettings4Line, RiUserLine, RiWallet3Line } from "@remixicon/react";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { EmptyState } from "./EmptyState";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoutButton } from "./LogoutButton";
import { StaffPageHeader } from "./StaffPage";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/portal";
import { ORG } from "@/lib/config";
import { cx } from "@/utils/cx";
import type { Language } from "@/lib/types";

const tabs = [
  { key: "home", path: "/dashboard", icon: RiHomeLine, label: "portal.home", phone: true },
  { key: "fees", path: "/dues", icon: RiWallet3Line, label: "portal.fees", phone: true },
  { key: "receipts", path: "/receipts", icon: RiFileList3Line, label: "portal.receipts", phone: false },
  { key: "academic", path: "/progress", icon: RiBarChart2Line, label: "portal.academic", phone: true },
  { key: "course", path: "/course", icon: RiGraduationCapLine, label: "portal.course", phone: false },
  { key: "student", path: "/student", icon: RiUserLine, label: "portal.student", phone: false },
  { key: "settings", path: "/settings", icon: RiSettings4Line, label: "portal.settings", phone: false },
] as const;

export type ParentTab = (typeof tabs)[number]["key"];
const short = { home: "portal.home", fees: "portal.feesShort", academic: "portal.academicShort" } as const;

export const parentSectionClass = "flex flex-col gap-4 border-t border-separator-border pt-6 first:border-t-0 first:pt-0";
export const withStudent = (path: string, student: string, family: unknown[]) => family.length > 1 ? `${path}?student=${encodeURIComponent(student)}` : path;

export interface ParentShellProps {
  language: Language; active: ParentTab; family: { studentId: string; fullName: string }[]; selected: string;
  state?: "loading" | "empty" | null; emptyTitle?: string; title?: string; description?: string; showName?: boolean; showLanguage?: boolean; children?: ReactNode;
}

// The staff frame's structure, drawn on the server with plain links: StaffShell's client sidebar and drawer would put /dues over its 200 KB script budget.
export function ParentShell({ language, active, family, selected, state, emptyTitle, title, description, showName = true, showLanguage = true, children }: ParentShellProps) {
  const href = (path: string, student = selected) => withStudent(path, student, family);
  const tab = tabs.find((item) => item.key === active)!;
  const name = family.find((child) => child.studentId === selected)?.fullName;
  return <div className="parent-surface min-h-dvh text-text-primary md:flex md:gap-8 md:p-6 print:block print:p-0">
    <div className="hidden w-60 shrink-0 md:block print:hidden"><aside className="sticky top-6 flex h-[calc(100dvh-48px)] flex-col gap-10 rounded-3xl bg-background-secondary-default p-5">
      <div><p className="text-headline-medium">{ORG.name}</p><p className="text-body-regular text-text-secondary">{ORG.city} · {pt(language, "portal.area")}</p></div>
      <nav aria-label={pt(language, "portal.nav")} className="flex flex-col gap-1">{tabs.map((item) => <a key={item.key} href={href(item.path)} aria-current={item.key === active ? "page" : undefined} className={cx("flex items-center gap-2 rounded-2lg p-2", item.key === active ? "bg-button-primary text-text-white" : "text-text-secondary hover:bg-background-secondary-hover")}>
        <item.icon aria-hidden className="size-5 shrink-0" /><span className="text-body-medium">{pt(language, item.label)}</span>
      </a>)}</nav>
      <div className="mt-auto"><LogoutButton language={language} /></div>
    </aside></div>
    <main className="mx-auto flex w-full min-w-0 max-w-[720px] flex-col gap-6 px-4 pb-28 pt-3 md:px-0 md:py-3 print:max-w-none print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        {family.length > 1 ? <nav aria-label={pt(language, "portal.children")} className="flex min-w-0 flex-wrap gap-2">{family.map((child) => <a key={child.studentId} href={href(tab.path, child.studentId)} aria-current={child.studentId === selected ? "page" : undefined} className={cx("flex items-center rounded-full px-4 text-body-medium", child.studentId === selected ? "bg-background-secondary-default text-text-primary" : "text-text-secondary hover:bg-background-secondary-hover")}>{child.fullName}</a>)}</nav> : <p className="min-w-0 text-headline-medium md:invisible">{ORG.name}</p>}
        {showLanguage ? <LanguageSwitcher language={language} /> : null}
      </div>
      {showName && name && family.length === 1 ? <p className="-mb-4 text-body-regular text-text-secondary print:hidden">{name}</p> : null}
      {title ?? state ? <StaffPageHeader title={title ?? pt(language, tab.label)} description={description ?? ""} /> : null}
      <div className="flex flex-col gap-8">
        {state === "loading" ? <div aria-busy="true" role="status" aria-label={t(language, "common.loading")} className="flex flex-col gap-6"><Skeleton className="h-12 w-3/4" /><Skeleton className="h-20 w-full" /><Skeleton className="h-12 w-full" /></div>
          : state === "empty" ? <EmptyState title={emptyTitle ?? ""} /> : children}
      </div>
    </main>
    <nav aria-label={pt(language, "portal.nav")} className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-separator-border bg-background-primary-default pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
      {tabs.filter((item) => item.phone).map((item) => <a key={item.key} href={href(item.path)} aria-current={item.key === active ? "page" : undefined} className={cx("flex min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 text-body-medium", item.key === active ? "text-accent-700" : "text-text-secondary")}>
        <item.icon aria-hidden className="size-5 shrink-0" /><span>{pt(language, short[item.key as keyof typeof short])}</span>
      </a>)}
      <details className="relative">
        <summary className={cx("flex min-h-12 cursor-pointer list-none flex-col items-center justify-center gap-0.5 py-1.5 text-body-medium [&::-webkit-details-marker]:hidden", tab.phone ? "text-text-secondary" : "text-accent-700")}><RiMoreLine aria-hidden className="size-5 shrink-0" /><span>{pt(language, "portal.more")}</span></summary>
        <div className="absolute bottom-full end-2 mb-2 flex w-56 flex-col rounded-2xl border border-border-button-default bg-background-primary-default p-2 shadow-xs">
          {tabs.filter((item) => !item.phone).map((item) => <a key={item.key} href={href(item.path)} aria-current={item.key === active ? "page" : undefined} className={cx("flex items-center gap-2 rounded-xl px-3 text-body-medium", item.key === active ? "bg-background-secondary-default text-text-primary" : "text-text-secondary")}><item.icon aria-hidden className="size-5 shrink-0" />{pt(language, item.label)}</a>)}
          <div className="border-t border-separator-border px-3"><LogoutButton language={language} /></div>
        </div>
      </details>
    </nav>
  </div>;
}

export function ParentDetails({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="divide-y divide-separator-border">{rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-6 py-3">
    <dt className="text-body-regular text-text-secondary">{label}</dt><dd className="min-w-0 text-end text-body-medium tabular-nums">{value}</dd>
  </div>)}</dl>;
}

export function GlanceRow({ href, label, value }: { href: string; label: string; value: ReactNode }) {
  return <li><a href={href} className="flex items-center justify-between gap-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
    <span className="flex min-w-0 flex-col gap-0.5"><span className="text-body-regular text-text-secondary">{label}</span><span className="text-body-medium tabular-nums">{value}</span></span>
    <RiArrowRightSLine aria-hidden className="size-5 shrink-0 text-foreground-icon-secondary rtl:rotate-180" />
  </a></li>;
}
