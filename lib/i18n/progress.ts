import { fill } from "./index";
import type { Language } from "@/lib/types";

// Copy for /progress only. It lives apart so /dues does not ship it: its script budget is 200 KB.
const en = {
  "progress.link": "Attendance and scores",
  "progress.title": "Attendance and test scores",
  "progress.attendance": "Attendance",
  "progress.summary": "Attended {attended} of {held} classes in the last {n} weeks",
  "progress.week": "Week of {date}",
  "progress.classes": "{attended} of {held}",
  "progress.tests": "Test scores",
  "progress.empty": "No attendance or test scores yet",
  "progress.noAttendance": "No attendance recorded yet",
  "progress.noTests": "No test scores yet",
};

const hi: typeof en = {
  "progress.link": "उपस्थिति और अंक",
  "progress.title": "उपस्थिति और टेस्ट के अंक",
  "progress.attendance": "उपस्थिति",
  "progress.summary": "पिछले {n} हफ़्तों में {held} में से {attended} कक्षाओं में उपस्थित",
  "progress.week": "{date} का हफ़्ता",
  "progress.classes": "{held} में से {attended}",
  "progress.tests": "टेस्ट के अंक",
  "progress.empty": "अभी उपस्थिति या टेस्ट के अंक नहीं हैं",
  "progress.noAttendance": "अभी उपस्थिति दर्ज नहीं हुई है",
  "progress.noTests": "अभी टेस्ट के अंक नहीं हैं",
};

export function pt(language: Language, key: keyof typeof en, values: Record<string, string | number> = {}): string {
  return fill((language === "hi" ? hi : en)[key], values);
}
