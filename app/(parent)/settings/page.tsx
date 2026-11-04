import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { ParentDetails, ParentShell, parentSectionClass } from "@/components/app/ParentShell";
import { LinkButton } from "@/components/base/buttons/link-button";
import { parentPage } from "@/lib/data/parent-page";
import { phoneLabel } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pt } from "@/lib/i18n/portal";
import type { SearchParams } from "@/lib/preview";

export default async function Settings({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { context, language, state, shell } = await parentPage(await searchParams);
  const header = { active: "settings", showName: false, showLanguage: false, title: pt(language, "portal.settings"), description: pt(language, "settings.description"), emptyTitle: pt(language, "settings.empty") } as const;
  if (state) return <ParentShell {...shell} {...header} />;
  return <ParentShell {...shell} {...header}>
    <section className={parentSectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-headline-medium">{pt(language, "settings.language")}</h2><LanguageSwitcher language={language} /></div>
      <ParentDetails rows={[[pt(language, "settings.phone"), <bdi key="phone">{phoneLabel(context.phone ?? "")}</bdi>]]} />
    </section>
    <section className={parentSectionClass}>
      <h2 className="text-headline-medium">{pt(language, "settings.permissions")}</h2>
      <ul className="flex list-disc flex-col gap-2 ps-5 text-body-regular">{(["consent.p1", "consent.p2", "consent.p3", "consent.p4"] as const).map((key) => <li key={key}>{t(language, key)}</li>)}</ul>
    </section>
    <section className={parentSectionClass}><div><LinkButton href="/refund-policy" variant="secondary">{pt(language, "portal.refundPolicy")}</LinkButton></div></section>
  </ParentShell>;
}
