import type { RefundResult } from "@/lib/types";

// Precomputed demo snapshots; authoritative refund rules will live in Django.
export const refundSnapshots: Record<string, { date: string; status: "new" | "draft" | "approved" | "paid"; calc: RefundResult }> = {
  "STU-0412": {
    "date": "2026-11-02",
    "status": "new",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 1898631,
      "stillPayable": 0,
      "deadline": "2026-11-12",
      "taxable": 1609009,
      "cgst": 144811,
      "sgst": 144811
    }
  },
  "STU-0587": {
    "date": "2026-11-02",
    "status": "new",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 398631,
      "stillPayable": 0,
      "deadline": "2026-11-12",
      "taxable": 337823,
      "cgst": 30404,
      "sgst": 30404
    }
  },
  "STU-0219": {
    "date": "2026-11-02",
    "status": "new",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 898631,
      "stillPayable": 0,
      "deadline": "2026-11-12",
      "taxable": 761552,
      "cgst": 68539,
      "sgst": 68540
    }
  },
  "STU-0771": {
    "date": "2026-11-02",
    "status": "new",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 0,
      "stillPayable": 1101369,
      "deadline": "2026-11-12",
      "taxable": 0,
      "cgst": 0,
      "sgst": 0
    }
  },
  "STU-0801": {
    "date": "2026-11-02",
    "status": "draft",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 898631,
      "stillPayable": 0,
      "deadline": "2026-11-12",
      "taxable": 761552,
      "cgst": 68539,
      "sgst": 68540
    }
  },
  "STU-0802": {
    "date": "2026-10-28",
    "status": "approved",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 211,
      "earned": 6936986,
      "refund": 2063014,
      "stillPayable": 0,
      "deadline": "2026-11-07",
      "taxable": 1748317,
      "cgst": 157348,
      "sgst": 157349
    }
  },
  "STU-0803": {
    "date": "2026-10-15",
    "status": "approved",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 198,
      "earned": 6509589,
      "refund": 2490411,
      "stillPayable": 0,
      "deadline": "2026-10-25",
      "taxable": 2110518,
      "cgst": 189946,
      "sgst": 189947
    }
  },
  "STU-0804": {
    "date": "2026-10-05",
    "status": "paid",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 188,
      "earned": 6180821,
      "refund": 1819179,
      "stillPayable": 0,
      "deadline": "2026-10-15",
      "taxable": 1541677,
      "cgst": 138751,
      "sgst": 138751
    }
  },
  "STU-0772": {
    "date": "2026-11-02",
    "status": "new",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 898631,
      "stillPayable": 0,
      "deadline": "2026-11-12",
      "taxable": 761552,
      "cgst": 68539,
      "sgst": 68540
    }
  },
  "STU-0733": {
    "date": "2026-11-02",
    "status": "new",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 0,
      "stillPayable": 4101369,
      "deadline": "2026-11-12",
      "taxable": 0,
      "cgst": 0,
      "sgst": 0
    }
  },
  "STU-0734": {
    "date": "2026-11-02",
    "status": "new",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 0,
      "stillPayable": 7101369,
      "deadline": "2026-11-12",
      "taxable": 0,
      "cgst": 0,
      "sgst": 0
    }
  },
  "STU-0735": {
    "date": "2026-11-02",
    "status": "new",
    "calc": {
      "totalDays": 365,
      "elapsedDays": 216,
      "earned": 7101369,
      "refund": 1898631,
      "stillPayable": 0,
      "deadline": "2026-11-12",
      "taxable": 1609009,
      "cgst": 144811,
      "sgst": 144811
    }
  }
};

export const refundPolicy = {
  "version": "v1",
  "textEn": "Refund Policy v1. Assumed for this demo; the client's written policy replaces it.\n1. If a student leaves, the fee is charged only for the days up to and including the date we receive written notice.\n2. Fee for days used = fee after discounts × days used ÷ total days in the session.\n3. Refund = amount paid − fee for days used. If the fee for days used is more than the amount paid, the difference remains payable.\n4. We pay the refund within 10 days of the notice date.\n5. A credit note with the refund shows GST.",
  "textHi": "रिफंड नीति v1। इस डेमो के लिए मानी गई है; क्लाइंट की लिखित नीति इसकी जगह लेगी।\n1. छात्र के छोड़ने पर फीस केवल उन दिनों की ली जाएगी जो लिखित सूचना मिलने की तारीख तक (उस दिन सहित) पूरे हुए हैं।\n2. उपयोग किए गए दिनों की फीस = छूट के बाद की फीस × उपयोग किए गए दिन ÷ सत्र के कुल दिन।\n3. रिफंड = भुगतान की गई राशि − उपयोग किए गए दिनों की फीस। अगर यह फीस भुगतान की गई राशि से ज़्यादा है, तो अंतर देय रहेगा।\n4. हम सूचना की तारीख से 10 दिनों के भीतर रिफंड देंगे।\n5. रिफंड के साथ क्रेडिट नोट पर GST दिखाया जाएगा।"
};
