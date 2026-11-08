import { ButtonLink } from "@/components/base/buttons/button";
import { ORG } from "@/lib/config";
import { PageShell } from "@/components/app/PageShell";

export default function Home() {
  return (
    <PageShell className="flex min-h-dvh flex-col justify-center gap-8 py-12">
      <header className="flex flex-col gap-2" lang="en">
        <p className="text-headline-medium">{ORG.name} · {ORG.city}</p>
        <h1 className="text-title-1-medium">Coaching fees</h1>
      </header>
      <div className="flex flex-col gap-3">
        <p className="text-headline-regular" lang="hi">फीस और भुगतान की जानकारी</p>
        <p className="text-body-regular text-text-secondary" lang="en">
          Fee details and payments for parents, with dues and reminders for staff.
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
