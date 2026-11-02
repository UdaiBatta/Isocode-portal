import { AuthLayout } from "@/components/app/AuthLayout";
import { PageShell } from "@/components/app/PageShell";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { StaffSignIn } from "@/components/app/StaffSignIn";
import { previewState, type SearchParams } from "@/lib/preview";

export default async function StaffLogin({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const state = previewState(await searchParams);
  if (state === "loading") return <PageSkeleton language="en" />;
  if (state === "empty") return <PageShell><EmptyState title="Contact your centre for staff access" /></PageShell>;
  return <div lang="en"><AuthLayout variant="staff" language="en"><StaffSignIn /></AuthLayout></div>;
}
