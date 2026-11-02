"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { setLanguage } from "@/lib/actions/auth";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function LanguageSwitcher({ language }: { language: Language }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-end">
      <SegmentedControl variant="plain" aria-label={t(language, "common.language")} selectedKeys={[language]} isDisabled={pending} onSelectionChange={(keys) => {
        const selected = Array.from(keys)[0];
        if (selected !== "hi" && selected !== "en") return;
        startTransition(async () => {
          try { const result = await setLanguage({ language: selected }); setFailed(!result.ok); if (result.ok) router.refresh(); }
          catch { setFailed(true); }
        });
      }}>
        <SegmentedControlItem id="hi" lang="hi">हिंदी</SegmentedControlItem>
        <SegmentedControlItem id="en" lang="en">English</SegmentedControlItem>
      </SegmentedControl>
      {failed ? <p role="alert" className="text-body-regular text-text-error-primary">{t(language, "common.loadFailed")}</p> : null}
    </div>
  );
}
