"use client";

import { ErrorState } from "@/components/app/ErrorState";
import { StaffShell } from "@/components/app/StaffShell";
import { retryRoute } from "@/lib/preview";

export default function ManageError({ reset }: { reset: () => void }) {
  return <StaffShell admin><ErrorState language="en" onRetry={() => retryRoute(reset)} /></StaffShell>;
}
