import { ButtonLink } from "@/components/base/buttons/button";
import { ORG } from "@/lib/config";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { getLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const language = await getLanguage();
  const state = previewState(await searchParams);
  if (state === "loading") return <PageSkeleton language={language} />;
  if (state === "empty") return <PageShell><EmptyState title={t(language, "setup.empty")} /></PageShell>;
  return (
    <PageShell className="flex min-h-dvh flex-col justify-center gap-8 py-12">
      <header className="flex flex-col gap-2" lang="en">
        <p className="text-headline-medium">{ORG.name} · {ORG.city}</p>
        <h1 className="text-title-1-medium">Coaching fees</h1>
      </header>
      <div className="flex flex-col gap-3">
        <p className="text-headline-regular" lang="hi">फीस और भुगतान की जानकारी</p>
        <p className="text-body-regular text-text-secondary" lang="en">
          Prototype setup. The parent and accounts screens are the next build step.
        </p>
      </div>
      <ButtonLink
        href="https://github.com/UdaiBatta/Isocode-portal"
        className="h-12 text-headline-medium"
        lang="en"
      >
        View project
      </ButtonLink>
    </PageShell>
  );
}
