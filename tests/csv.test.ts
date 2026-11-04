import { expect, it } from "vitest";
import { csv } from "@/lib/csv";

it("escapes CSV values and neutralises spreadsheet formulas", () => {
  expect(csv([["=SUM(A1)", 'a,"b', "+1", " @x", 100]])).toBe('"\'=SUM(A1)","a,""b","\'+1","\' @x","100"\r\n');
});
