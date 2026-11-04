"use client";

import { StaffRouteError } from "@/components/app/StaffRouteError";

export default function CounsellorError({ reset }: { reset: () => void }) {
  return <StaffRouteError reset={reset} counsellor />;
}
