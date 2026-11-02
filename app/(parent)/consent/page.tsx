import { redirect } from "next/navigation";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { LogoutButton } from "@/components/app/LogoutButton";
import { ParentConsent } from "@/components/app/ParentConsent";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { t } from "@/lib/i18n";

export default async function Consent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const view = await getParentPageContext(params.next);
  const state = previewState(params);
  if (state === "loading") return <PageSkeleton language={view.language} />;
  if (state === "empty") return <PageShell><EmptyState title={t(view.language, "consent.empty")} /></PageShell>;
  if (view.role !== "parent") redirect("/login");
  return <PageShell className="flex flex-col gap-8">
    <div className="flex justify-end"><LanguageSwitcher language={view.language} /></div>
    {view.children.length ? <ParentConsent language={view.language} students={view.children} declined={view.declined} next={view.next} /> : <><EmptyState title={t(view.language, "consent.empty")} description={t(view.language, "login.noCodeHelp")} /><LogoutButton language={view.language} /></>}
  </PageShell>;
}
