import { AuthLayout } from "@/components/app/AuthLayout";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { ParentLogin } from "@/components/app/ParentLogin";
import { getParentPageContext } from "@/lib/data/auth";
import { previewState, type SearchParams } from "@/lib/preview";
import { t } from "@/lib/i18n";

export default async function Login({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const view = await getParentPageContext(params.next);
  const state = previewState(params);
  if (state === "loading") return <PageSkeleton language={view.language} />;
  if (state === "empty") return <PageShell><EmptyState title={t(view.language, "login.noCodeHelp")} /></PageShell>;
  return <AuthLayout variant="parent" language={view.language} action={<LanguageSwitcher language={view.language} />}><ParentLogin language={view.language} next={view.next} demo={view.demo} tagline={view.language === "hi" ? "बकाया देखें, फीस भरें और रसीद पाएँ।" : "Check dues, pay fees and get your receipts."} /></AuthLayout>;
}
