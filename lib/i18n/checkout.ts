import { fill, t, type TranslationKey } from "./index";
import type { Language } from "@/lib/types";

// Copy for checkout and payment results only. It lives apart so /dues and /pay do not ship it: their script budget is 200 KB.
const en = {
  "pay.failedHelp": "No money was taken from your account.",
  "pay.checkingHelp": "The amount did not match this instalment. Our accounts team will confirm it. You do not need to pay again.",
  "checkout.title": "Secure checkout",
  "checkout.instalment": "Fee instalment {n}",
  "checkout.instalmentFor": "Fee instalment {n} for {name}",
  "checkout.payWith": "Pay with",
  "checkout.upiHint": "Approve the request in your UPI app",
  "checkout.card": "Debit or credit card",
  "checkout.cardHint": "Test card ending 1111",
  "checkout.netbankingHint": "Test Bank",
  "checkout.receiptNote": "Your GST receipt is ready as soon as the payment is confirmed.",
  "checkout.step.upi": "Waiting for approval in your UPI app",
  "checkout.step.card": "Checking your card with the bank",
  "checkout.step.netbanking": "Connecting to your bank",
  "checkout.step.confirm": "Confirming the payment",
  "checkout.step.record": "Updating your fee record",
  "checkout.keepOpen": "Please do not press back or close this page.",
  "result.paidTo": "Paid to",
  "result.for": "For",
  "result.reference": "Transaction ID",
  "result.testNote": "Test payment. No real money moved.",
  "receipt.method.upi": "UPI",
  "receipt.method.card": "Card",
  "receipt.method.netbanking": "Net banking",
};

const hi = {
  "pay.failedHelp": "आपके खाते से कोई पैसा नहीं कटा।",
  "pay.checkingHelp": "राशि इस किस्त से मेल नहीं खाई। हमारी अकाउंट्स टीम इसकी पुष्टि करेगी। आपको दोबारा भुगतान करने की ज़रूरत नहीं है।",
  "checkout.title": "सुरक्षित भुगतान",
  "checkout.instalment": "फीस की किस्त {n}",
  "checkout.instalmentFor": "{name} की फीस की किस्त {n}",
  "checkout.payWith": "भुगतान का तरीका",
  "checkout.upiHint": "अपने UPI ऐप में अनुरोध स्वीकार करें",
  "checkout.card": "डेबिट या क्रेडिट कार्ड",
  "checkout.cardHint": "टेस्ट कार्ड, आखिरी अंक 1111",
  "checkout.netbankingHint": "टेस्ट बैंक",
  "checkout.receiptNote": "भुगतान की पुष्टि होते ही आपकी GST रसीद तैयार हो जाएगी।",
  "checkout.step.upi": "आपके UPI ऐप में स्वीकृति का इंतज़ार है",
  "checkout.step.card": "बैंक से आपके कार्ड की जाँच हो रही है",
  "checkout.step.netbanking": "आपके बैंक से जुड़ रहे हैं",
  "checkout.step.confirm": "भुगतान की पुष्टि हो रही है",
  "checkout.step.record": "आपका फीस रिकॉर्ड अपडेट हो रहा है",
  "checkout.keepOpen": "कृपया पीछे न जाएँ और यह पेज बंद न करें।",
  "result.paidTo": "भुगतान पाने वाला",
  "result.for": "किसके लिए",
  "result.reference": "लेन-देन आईडी",
  "result.testNote": "यह टेस्ट भुगतान है। कोई असली पैसा नहीं गया।",
  "receipt.method.upi": "UPI",
  "receipt.method.card": "कार्ड",
  "receipt.method.netbanking": "नेट बैंकिंग",
} satisfies Record<keyof typeof en, string>;

export type CheckoutKey = keyof typeof en;

export function ct(language: Language, key: CheckoutKey, values: Record<string, string | number> = {}): string {
  return fill((language === "hi" ? hi : en)[key], values);
}

const methodKeys: Record<string, CheckoutKey | TranslationKey> = { upi: "receipt.method.upi", card: "receipt.method.card", netbanking: "receipt.method.netbanking", bank: "receipt.method.bank", gateway: "receipt.method.gateway", cash: "receipt.method.cash", cheque: "receipt.method.cheque" };

export function methodLabel(language: Language, method: string): string {
  const key = methodKeys[method] ?? "receipt.method.other";
  return key in en ? ct(language, key as CheckoutKey) : t(language, key as TranslationKey);
}
