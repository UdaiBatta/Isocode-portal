"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function ChildSwitcher({ students, selected, language }: { students: { studentId: string; fullName: string }[]; selected: string; language: Language }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <SegmentedControl aria-label={t(language, "dues.child")} selectedKeys={[selected]} isDisabled={pending} className="flex-wrap" onSelectionChange={(keys) => {
    const id = Array.from(keys)[0];
    if (typeof id === "string" && students.some((student) => student.studentId === id)) startTransition(() => router.push(`/dues?student=${encodeURIComponent(id)}`));
  }}>{students.map((student) => <SegmentedControlItem key={student.studentId} id={student.studentId}>{student.fullName}</SegmentedControlItem>)}</SegmentedControl>;
}
