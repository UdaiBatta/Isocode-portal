import { SkeletonBlocks } from "@/components/app/PageSkeleton";
import { StaffShell } from "@/components/app/StaffShell";

export default function ManageLoading() {
  return <StaffShell admin><SkeletonBlocks language="en" /></StaffShell>;
}
