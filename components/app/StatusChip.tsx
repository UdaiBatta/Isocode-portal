import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { t, type TranslationKey } from "@/lib/i18n";
import type { Language } from "@/lib/types";

const statuses = {
  paid: ["lime", "status.paid"],
  part_paid: ["yellow", "status.partPaid"],
  overdue: ["rose", "status.overdue"],
  upcoming: ["neutral", "status.upcoming"],
  due_today: ["yellow", "status.dueToday"],
  watch: ["yellow", "status.watch"],
  high: ["rose", "status.high"],
  insufficient: ["neutral", "status.insufficient"],
  approved: ["cyan", "refund.approved"],
  draft: ["neutral", "refund.draft"],
} satisfies Record<string, [ChipColor, TranslationKey]>;

export function StatusChip({ status, language = "en" }: { status: keyof typeof statuses; language?: Language }) {
  const [color, key] = statuses[status];
  return <Chip color={color}>{t(language, key)}</Chip>;
}
