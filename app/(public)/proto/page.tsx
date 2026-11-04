import { notFound } from "next/navigation";
import { PrototypeIndex } from "@/components/app/PrototypeIndex";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { LinkButton } from "@/components/base/buttons/link-button";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function Prototype({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (process.env.NEXT_PUBLIC_PROTO !== "1") notFound();
  const state = previewState(await searchParams);
  if (state === "loading") return <PageSkeleton language="en" />;
  return <main lang="en" className="paper-surface mx-auto flex max-w-5xl flex-col gap-8 p-5 md:p-10"><header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-title-1-medium">Prototype screens</h1><LinkButton href="/demo" variant="secondary">Reviewer walkthrough</LinkButton></header>{state === "empty" ? <EmptyState title="No prototype screens" /> : <PrototypeIndex />}</main>;
}
