import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { LogoutButton } from "@/components/app/LogoutButton";
import { ParentDetails, ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { StaffFrame } from "@/components/app/StaffPage";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getFamily } from "@/lib/data/student";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { phoneLabel } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/portal";

export default async function Settings({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const context = await getParentPageContext();
  const { language } = context;
  const state = previewState(query);
  if (state === "loading") return <PageSkeleton language={language} />;
  if (state === "empty") return <PageShell><EmptyState title={pt(language, "settings.empty")} /></PageShell>;
  if (context.role !== "parent") redirect("/login");
  if (!context.consent) redirect("/consent");
  const family = await getFamily(typeof query.student === "string" ? query.student : undefined);
  return <ParentShell language={language} active="settings" {...family} showLanguage={false} title={pt(language, "portal.settings")} description={pt(language, "settings.description")}>
    <StaffFrame>
      <section className={parentSectionClass}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-headline-medium">{pt(language, "settings.language")}</h2><LanguageSwitcher language={language} /></div>
        <ParentDetails rows={[[pt(language, "settings.phone"), <bdi key="phone">{phoneLabel(context.phone ?? "")}</bdi>]]} />
      </section>
      <section className={parentSectionClass}>
        <h2 className="text-headline-medium">{pt(language, "settings.permissions")}</h2>
        <ul className="flex list-disc flex-col gap-2 ps-5 text-body-regular">{(["consent.p1", "consent.p2", "consent.p3", "consent.p4"] as const).map((key) => <li key={key}>{t(language, key)}</li>)}</ul>
      </section>
      <section className={parentSectionClass}>
        <div className="flex flex-wrap items-center gap-6"><LinkButton href="/refund-policy" variant="secondary">{pt(language, "portal.refundPolicy")}</LinkButton><span className="md:hidden"><LogoutButton language={language} /></span></div>
      </section>
    </StaffFrame>
  </ParentShell>;
}
