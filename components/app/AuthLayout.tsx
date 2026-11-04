import type { ReactNode } from "react";
import { ORG } from "@/lib/config";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";
import type { Language } from "@/lib/types";

// Server-only copy, so /login ships none of it. Every figure comes from the brief or the sample data, and nothing here is an invented claim.
const panels = {
  parent: {
    en: { badge: "Test mode · sample data", label: "Fee due", value: "₹15,000", note: "Was due 10 Oct", steps: "After you pay", timeline: [["1", "Pay by UPI, card or net banking"], ["2", "Get your GST receipt at once"], ["3", "Reminders for this fee stop"]], headline: "See your dues, pay and get a receipt, in Hindi or English.", detail: "One place for your child's fees, without calling the centre." },
    hi: { badge: "टेस्ट मोड · नमूना डेटा", label: "बकाया फीस", value: "₹15,000", note: "अंतिम तिथि 10 अक्टूबर थी", steps: "भुगतान के बाद", timeline: [["1", "UPI, कार्ड या नेट बैंकिंग से भुगतान करें"], ["2", "तुरंत GST रसीद पाएँ"], ["3", "इस फीस के रिमाइंडर बंद हो जाते हैं"]], headline: "बकाया देखें, भुगतान करें और रसीद पाएँ, हिंदी या अंग्रेज़ी में।", detail: "आपके बच्चे की फीस की पूरी जानकारी एक जगह, सेंटर को फोन किए बिना।" },
  },
  staff: {
    en: { badge: "Test mode · sample data", label: "Over 60 days late", value: "12.1%", note: "Target 6%", steps: "Ishita · instalment 3", timeline: [["10 Oct", "Fee due"], ["25 Oct", "15-day reminder sent"], ["2 Nov", "Paid on the parent portal"], ["9 Nov", "Next reminder stopped"]], headline: "One view of dues across all centres, by batch.", detail: "Four centres and 2,600 students, with reminders that stop on payment." },
    hi: null,
  },
};

function BrandMark() {
  return <span className="grid size-8 place-items-center rounded-lg bg-accent-700" aria-hidden="true">
    <svg viewBox="0 0 16 16" className="size-4" fill="none" strokeLinecap="round" strokeLinejoin="round"><path className="stroke-background-primary-default" strokeWidth="1.5" d="M4 3h8M4 6h8M6.5 3c2.8 0 4 1.3 4 3S9 9 6.5 9H4l6 5" /></svg>
  </span>;
}

// A closed ledger with one page slipped out of it: the sample figures sit on real ruled paper, stamped.
function AuthPanel({ variant, language }: { variant: keyof typeof panels; language: Language }) {
  const copy = panels[variant][language] ?? panels[variant].en;
  return <aside aria-label={ORG.name} className="hidden min-h-0 lg:flex">
    <div className="ledger-cover ledger-butti relative flex w-full flex-col justify-between gap-8 overflow-hidden p-12 xl:p-14">
      <span className="ledger-cover-frame" aria-hidden="true" />
      <p className="ledger-cover-note text-body-2-regular">{copy.badge}</p>
      <p className="ledger-cover-title max-w-md text-balance">{copy.headline}</p>
      <div className="ledger-folio ledger-cover-sheet w-[min(100%,420px)] -rotate-1" aria-hidden="true">
        <p className="text-body-2-regular text-text-secondary">{copy.label}</p>
        <p className="ledger-type text-display-4-medium tabular-nums">{copy.value}</p>
        <span className="ledger-stamp absolute end-5 top-6">{copy.note}</span>
        <p className="mt-3 text-body-medium">{copy.steps}</p>
        <ol className="flex flex-col">{copy.timeline.map(([time, label]) => <li key={time} className="flex h-8 items-center gap-2.5 text-body-2-regular">
          {variant === "staff" ? <span className="w-12 shrink-0 tabular-nums text-text-secondary">{time}</span> : null}
          <span className="text-text-secondary">{label}</span>
        </li>)}</ol>
      </div>
      <p className="ledger-cover-note max-w-md text-body-regular text-balance">{copy.detail}</p>
    </div>
  </aside>;
}

export function AuthLayout({ variant, language, action, children }: { variant: keyof typeof panels; language: Language; action?: ReactNode; children: ReactNode }) {
  return <div className="ledger-top-band grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
    <main className={cx("flex min-h-dvh min-w-0 flex-col", variant === "parent" ? "parent-surface" : "staff-surface")}>
      <header className="flex items-center justify-between gap-4 px-5 pt-5 md:px-8 md:pt-7">
        <span className="ledger-type flex items-center gap-2.5 text-title-2-medium"><BrandMark />{ORG.name}</span>
        {action}
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-8 md:px-8"><div className="w-full max-w-[384px]">{children}</div></div>
      <footer className="flex flex-wrap items-center justify-between gap-x-4 px-5 pb-3 text-body-2-regular text-text-secondary md:px-8 md:pb-5">
        <span>© 2026 {ORG.name}, {ORG.city}</span>
        <a href="/refund-policy" className="inline-flex items-center rounded-sm hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:outline-none">{t(language, "policy.title")}</a>
      </footer>
    </main>
    <AuthPanel variant={variant} language={language} />
  </div>;
}
