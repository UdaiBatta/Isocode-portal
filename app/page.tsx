import { ButtonLink } from "@/components/base/buttons/button";
import { ORG } from "@/lib/config";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center gap-8 px-5 py-12">
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
        href="https://github.com/UdaiBatta/isocode-coaching_tracker"
        className="h-12 text-headline-medium"
        lang="en"
      >
        View project
      </ButtonLink>
    </main>
  );
}
