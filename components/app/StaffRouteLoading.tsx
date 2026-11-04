import { SkeletonBlocks } from "./PageSkeleton";
import { StaffShell } from "./StaffShell";

export function StaffRouteLoading({ counsellor = false }: { counsellor?: boolean }) {
  return <StaffShell counsellor={counsellor}><SkeletonBlocks language="en" /></StaffShell>;
}
