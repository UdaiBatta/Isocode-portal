import { PageShell } from "@/components/app/PageShell";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { ORG } from "@/lib/config";
import { LinkButton } from "@/components/base/buttons/link-button";
import { getLocalizedRefundPolicy } from "@/lib/data/refund";
import { getParentPageContext } from "@/lib/data/auth";
import { t } from "@/lib/i18n";

export default async function Policy() {
  const context = await getParentPageContext();
  const { language } = context;
  const policy = await getLocalizedRefundPolicy();
  const [intro, ...rules] = policy.text.split("\n");
  return <PageShell className="flex flex-col gap-8"><div className="flex items-center justify-between gap-3"><p className="ledger-type text-title-2-medium">{ORG.name}</p><LanguageSwitcher language={language} /></div><h1 className="text-title-1-medium">{t(language, "policy.title")}</h1><p className="text-headline-regular text-text-secondary">{intro}</p><ol className="flex list-decimal flex-col gap-5 ps-5 text-headline-regular">{rules.map((rule) => <li key={rule}>{rule.replace(/^\d+\.\s*/, "")}</li>)}</ol><LinkButton href={context.role === "parent" && context.consent ? "/dues" : "/login"} variant="secondary">{t(language, "pay.backToDues")}</LinkButton></PageShell>;
}
