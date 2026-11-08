import { AuthLayout } from "@/components/app/AuthLayout";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { ParentLogin } from "@/components/app/ParentLogin";
import { getParentPageContext } from "@/lib/data/auth";
import type { SearchParams } from "@/lib/types";

export default async function Login({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const view = await getParentPageContext(params.next);
  return <AuthLayout variant="parent" language={view.language} action={<LanguageSwitcher language={view.language} />}><ParentLogin language={view.language} next={view.next} demo={view.demo} tagline={view.language === "hi" ? "बकाया देखें, फीस भरें और रसीद पाएँ।" : "Check dues, pay fees and get your receipts."} /></AuthLayout>;
}
