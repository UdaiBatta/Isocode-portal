"use client";

import { ErrorState } from "@/components/app/ErrorState";
import { retryRoute } from "@/lib/preview";

export default function StaffLoginError({ reset }: { reset: () => void }) {
  return <ErrorState language="en" onRetry={() => retryRoute(reset)} />;
}
