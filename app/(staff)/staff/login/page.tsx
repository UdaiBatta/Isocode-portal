import { SkeletonBlocks } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { StaffSignIn } from "@/components/app/StaffSignIn";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function StaffLogin({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const state = previewState(await searchParams);
  if (state === "loading") return <SkeletonBlocks language="en" />;
  if (state === "empty") return <EmptyState title="Contact your centre for staff access" />;
  return <StaffSignIn />;
}
