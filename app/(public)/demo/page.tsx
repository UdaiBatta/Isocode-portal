import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import BlurText from "@/components/vendor/reactbits/BlurText/BlurText";
import { previewState, type SearchParams } from "@/lib/preview";

const steps = [
  ["See what is due", "Sign in as Ishita's parent and check the amount, date and Pay button.", "/login"],
  ["Make a mock payment", "Try success, failure or a wrong amount. Open the GST receipt after a successful payment.", "/mock-gateway/STU-0587-3"],
  ["Check the accounts view", "Open Ishita's ledger and compare the batch total after payment.", "/staff/dashboard"],
  ["See reminders stop", "Open Automation. Paid instalments are stopped; use the demo date to run reminders.", "/staff/automation"],
  ["Explain a refund", "Read the worked policy calculation, save a draft and approve the refund.", "/staff/students/STU-0587/refund"],
  ["Review a risk flag", "Sign in as the counsellor, review the reasons and record a call outcome or false flag.", "/counsellor/tasks"],
] as const;

export default async function Demo({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (process.env.DEMO_MODE !== "true") notFound();
  const state = previewState(await searchParams);
  if (state === "loading") return <PageSkeleton language="en" />;
  return <main lang="en" className="paper-surface mx-auto flex max-w-5xl flex-col gap-14 px-5 py-12 md:py-20">
    <header className="flex max-w-3xl flex-col items-start gap-6"><p className="text-body-medium text-accent-700">Company A · Jaipur</p><h1 className="text-display-4-semibold md:text-display-3-semibold"><BlurText text="Clear dues. Timely follow-up." /></h1><p className="text-title-3-regular text-text-secondary">Parents see what they owe and when. Accounts teams see dues across centres, reminders that stop on payment, and refunds explained by policy.</p><ButtonLink href="/login">Start</ButtonLink><p className="text-body-2-regular text-text-secondary">Local prototype · fictional sample data · no real money or messages</p></header>
    {state === "empty" ? <EmptyState title="No demo scenarios available" /> : <>
      <section className="grid gap-5 md:grid-cols-3" aria-label="Demo roles">{[
        ["Parent", "Amount, due date and a way to pay, in Hindi or English.", "/login", "+91 90000 00587 · Ishita"],
        ["Accounts", "Centre and batch dues, student ledgers, refunds and reminders.", "/staff/login", "accounts@demo.test"],
        ["Counsellor", "A call task with reasons and space to record what you learn.", "/staff/login", "counsellor@demo.test"],
      ].map(([name, description, href, login]) => <article key={name} className="flex flex-col gap-4 rounded-3xl border border-border-button-default p-6"><h2 className="text-title-2-medium">{name}</h2><p className="text-body-regular text-text-secondary">{description}</p><p className="break-words text-body-2-regular">{login}</p><LinkButton href={href} variant="secondary" className="mt-auto justify-start">Open {name.toLowerCase()} sign-in</LinkButton></article>)}</section>
      <section className="flex flex-col gap-6"><h2 className="text-title-1-medium">A six-step walkthrough</h2><ol className="grid gap-6 md:grid-cols-2">{steps.map(([title, description, href], index) => <li key={title} className="flex gap-4 border-t border-separator-border pt-5"><span className="text-body-medium text-accent-700">{index + 1}</span><div className="flex flex-col items-start gap-2"><LinkButton href={href} variant="secondary">{title}</LinkButton><p className="text-body-regular text-text-secondary">{description}</p></div></li>)}</ol></section>
      <section className="flex flex-col gap-3"><h2 className="text-headline-medium">Other sample families</h2><p className="text-body-regular text-text-secondary">Aarav: +91 90000 00412 · Mohit: +91 90000 00219 · Two children: +91 90000 00777</p><p className="text-body-regular text-text-secondary">Centre-only accounts: accounts.mlv@demo.test. Staff passwords are supplied separately with the run instructions.</p></section>
    </>}
    <footer className="flex flex-wrap gap-6"><LinkButton href="/refund-policy" variant="secondary">Refund policy</LinkButton>{process.env.NEXT_PUBLIC_PROTO === "1" ? <LinkButton href="/proto" variant="secondary">All prototype screens and states</LinkButton> : null}</footer>
  </main>;
}
