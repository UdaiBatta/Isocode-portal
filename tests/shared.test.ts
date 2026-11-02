import { afterEach, describe, expect, it, vi } from "vitest";
import { inr, dateLabel } from "@/lib/format";
import { t, languageFrom } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { hi } from "@/lib/i18n/hi";
import { previewState } from "@/lib/preview";

afterEach(() => vi.unstubAllEnvs());

describe("shared display rules", () => {
  it.each([
    [12000000, "₹1,20,000"], [398631, "₹3,986.31"], [1500000, "₹15,000"], [0, "₹0"], [1, "₹0.01"],
  ])("formats %i paise with Indian grouping", (paise, expected) => expect(inr(paise)).toBe(expected));

  it("formats UTC date-only values and includes a different year", () => {
    expect(dateLabel("2026-10-10", "en", "2026-11-02")).toBe("10 Oct");
    expect(dateLabel("2026-10-10", "hi", "2026-11-02")).toBe("10 अक्टूबर");
    expect(dateLabel("2027-01-10", "en", "2026-11-02")).toBe("10 Jan 2027");
  });

  it("keeps both dictionaries complete and substitutes values without changing Hindi", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
    expect(t("en", "dues.overdue", { n: 23 })).toBe("23 days overdue");
    expect(t("hi", "dues.pay", { amount: inr(1500000) })).toBe("₹15,000 का भुगतान करें");
    expect(() => t("hi", "dues.pay")).toThrow("Missing translation value");
    expect(languageFrom(undefined)).toBe("hi");
    expect(languageFrom("en")).toBe("en");
  });

  it("makes preview states available only in prototype mode", () => {
    vi.stubEnv("NEXT_PUBLIC_PROTO", "1");
    expect(previewState({ state: "loading" })).toBe("loading");
    expect(previewState({ state: "empty" })).toBe("empty");
    expect(() => previewState({ state: "error" })).toThrow("Prototype error preview");
    expect(previewState({ state: ["error"] })).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_PROTO", "0");
    expect(previewState({ state: "error" })).toBeNull();
  });
});
