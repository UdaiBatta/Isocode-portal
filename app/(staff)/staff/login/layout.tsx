import type { ReactNode } from "react";
import { AuthLayout } from "@/components/app/AuthLayout";

// Every sign-in state sits in the same dark frame, with no workspace navigation before sign-in.
export default function StaffLoginLayout({ children }: { children: ReactNode }) {
  return <div lang="en"><AuthLayout variant="staff" language="en">{children}</AuthLayout></div>;
}
