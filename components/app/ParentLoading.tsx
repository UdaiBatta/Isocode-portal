import { ParentShell, type ParentTab } from "./ParentShell";
import { parentLoadingShell } from "@/lib/data/parent-page";

export async function ParentLoading({ active }: { active: ParentTab }) {
  return <ParentShell {...await parentLoadingShell()} active={active} />;
}
