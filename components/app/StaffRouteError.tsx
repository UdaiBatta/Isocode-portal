"use client";

import { ErrorState } from "./ErrorState";
import { StaffShell } from "./StaffShell";
import { retryRoute } from "@/lib/preview";

// Keeps the staff frame and theme when a page fails. Navigation only: the page's data never reaches this fallback, and each page still checks the session on the server.
export function StaffRouteError({ reset, counsellor = false }: { reset: () => void; counsellor?: boolean }) {
  return <StaffShell counsellor={counsellor}><ErrorState language="en" onRetry={() => retryRoute(reset)} /></StaffShell>;
}
