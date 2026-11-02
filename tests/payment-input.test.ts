import { expect, it } from "vitest";
import { rupeesToPaise } from "@/lib/format";
it("reads rupees as exact integer paise and refuses invalid payments", () => {
  expect(rupeesToPaise("15000.01")).toBe(1500001);
  expect(rupeesToPaise("0.29")).toBe(29);
  for (const value of ["0", "-1", "1e3", "2.345", "NaN", "9007199254740991"]) expect(() => rupeesToPaise(value)).toThrow();
});
