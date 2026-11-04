import type { ProgressVM } from "@/lib/types";

const HELD = 5;
const weeks = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
const tests = [["2026-06-27", "Monthly Test 3"], ["2026-07-25", "Monthly Test 4"], ["2026-08-29", "Monthly Test 5"], ["2026-09-26", "Monthly Test 6"], ["2026-10-24", "Monthly Test 7"]];

// Oldest first. Riya's numbers are the ones behind her counsellor task: attendance 90% then 60%, tests 69% then 49%.
const named: Record<string, { attended: number[]; scores: number[] }> = {
  "STU-0587": { attended: [5, 5, 4, 5, 5, 4, 5, 5], scores: [78, 81, 84, 82, 86] },
  "STU-0733": { attended: [5, 4, 5, 4, 3, 3, 3, 3], scores: [72, 68, 67, 50, 48] },
  "STU-0735": { attended: [4, 5], scores: [64] },
};

// Everyone else gets steady made-up numbers, so nobody but Riya looks as if they are falling behind.
function steady(code: string) {
  const seed = Number(code.slice(4));
  return { attended: weeks.map((_, index) => (seed + index) % 4 === 0 ? HELD - 1 : HELD), scores: tests.map((_, index) => 62 + seed % 20 + [1, 0, 2, 1, 2][index]) };
}

// Newest first, leaving out anything after `until`.
export function progressFor(code: string, until: string): ProgressVM {
  const { attended, scores } = named[code] ?? steady(code);
  return {
    attendance: attended.map((count, index) => ({ weekStart: weeks[weeks.length - attended.length + index], attended: count, held: HELD })).filter((week) => week.weekStart <= until).reverse(),
    tests: scores.map((score, index) => ({ testDate: tests[tests.length - scores.length + index][0], testName: tests[tests.length - scores.length + index][1], score, maxScore: 100 })).filter((test) => test.testDate <= until).reverse(),
  };
}
