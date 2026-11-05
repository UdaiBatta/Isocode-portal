import { describe, expect, it } from "vitest";
import { renderReminder } from "@/lib/reminder-text";

const values = { student: "Mohit Gurjar", amount: "₹40,000", date: "15 Nov", link: "/pay/demo" };

describe("renderReminder", () => {
  it.each([
    ["en", -7, "Mohit Gurjar's fee instalment of ₹40,000 is due on 15 Nov. Pay here: /pay/demo"],
    ["en", 0, "Mohit Gurjar's fee instalment of ₹40,000 is due today. Pay here: /pay/demo"],
    ["en", 7, "Mohit Gurjar's fee instalment of ₹40,000 was due on 15 Nov. Pay here: /pay/demo. If you have already paid, please ignore this."],
    ["hi", -7, "Mohit Gurjar की फीस की किस्त ₹40,000, 15 Nov तक जमा करनी है। यहाँ भुगतान करें: /pay/demo"],
    ["hi", 0, "Mohit Gurjar की फीस की किस्त ₹40,000 आज जमा करनी है। यहाँ भुगतान करें: /pay/demo"],
    ["hi", 7, "Mohit Gurjar की फीस की किस्त ₹40,000 की अंतिम तिथि 15 Nov थी। यहाँ भुगतान करें: /pay/demo। अगर आप भुगतान कर चुके हैं, तो कृपया इसे अनदेखा करें।"],
  ] as const)("renders the %s reminder for step %i", (language, step, expected) => {
    expect(renderReminder(language, step, values)).toBe(expected);
  });
});
