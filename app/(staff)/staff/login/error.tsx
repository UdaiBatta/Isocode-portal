"use client";

import { ErrorState } from "@/components/app/ErrorState";

export default function StaffLoginError({ reset }: { reset: () => void }) {
  return <ErrorState language="en" onRetry={reset} />;
}
