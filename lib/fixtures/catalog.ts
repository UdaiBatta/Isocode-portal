import type { Language } from "@/lib/types";

export interface StudentFixture { code: string; name: string; batch: string; phone: string; language: Language; paid: number[]; enrolledOn: string; centreId?: string; discount?: number }

// All names and contact numbers are fictional, as specified in B10.
export const students: StudentFixture[] = [
  {
    "code": "STU-0412",
    "name": "Aarav Meena",
    "batch": "JEE 2027 Morning",
    "phone": "+919000000412",
    "language": "hi",
    "paid": [
      3000000,
      3000000,
      3000000,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0587",
    "name": "Ishita Sharma",
    "batch": "JEE 2027 Evening",
    "phone": "+919000000587",
    "language": "en",
    "paid": [
      3000000,
      3000000,
      1500000,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0219",
    "name": "Mohit Gurjar",
    "batch": "NEET 2027 Morning",
    "phone": "+919000000219",
    "language": "hi",
    "paid": [
      4000000,
      4000000,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0771",
    "name": "Kavya Joshi",
    "batch": "JEE 2027 Morning",
    "phone": "+919000000777",
    "language": "hi",
    "paid": [
      3000000,
      3000000,
      0,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0772",
    "name": "Dev Joshi",
    "batch": "NEET 2027 Morning",
    "phone": "+919000000777",
    "language": "hi",
    "paid": [
      4000000,
      4000000,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0733",
    "name": "Riya Verma",
    "batch": "JEE 2027 Evening",
    "phone": "+919000000733",
    "language": "hi",
    "paid": [
      3000000,
      0,
      0,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0734",
    "name": "Arjun Yadav",
    "batch": "NEET 2027 Evening",
    "phone": "+919000000734",
    "language": "en",
    "paid": [
      0,
      0,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0735",
    "name": "Neha Kumawat",
    "batch": "JEE 2027 Morning",
    "phone": "+919000000735",
    "language": "hi",
    "paid": [
      3000000,
      3000000,
      3000000,
      0
    ],
    "enrolledOn": "2026-10-20"
  },
  {
    "code": "STU-0801",
    "name": "Pooja Saini",
    "batch": "NEET 2027 Morning",
    "phone": "+919000000801",
    "language": "en",
    "paid": [
      4000000,
      4000000,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0802",
    "name": "Yash Agarwal",
    "batch": "JEE 2027 Morning",
    "phone": "+919000000802",
    "language": "en",
    "paid": [
      3000000,
      3000000,
      3000000,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0803",
    "name": "Tanvi Rathore",
    "batch": "JEE 2027 Evening",
    "phone": "+919000000803",
    "language": "hi",
    "paid": [
      3000000,
      3000000,
      3000000,
      0
    ],
    "enrolledOn": "2026-04-01"
  },
  {
    "code": "STU-0804",
    "name": "Naman Jain",
    "batch": "NEET 2027 Evening",
    "phone": "+919000000804",
    "language": "en",
    "paid": [
      4000000,
      4000000,
      0
    ],
    "enrolledOn": "2026-04-01"
  }
];

export const centres = [
  { id: "MLV", name: "Malviya Nagar" },
  { id: "VSH", name: "Vaishali Nagar" },
  { id: "MSR", name: "Mansarovar" },
  { id: "RJP", name: "Raja Park" },
] as const;

export const batches = centres.flatMap((centre) => ["JEE 2027 Morning", "JEE 2027 Evening", "NEET 2027 Morning", "NEET 2027 Evening"].map((name, index) => ({ id: `${centre.id}-${index + 1}`, name, centreId: centre.id })));

export const namedStudents = [...students];
const firstNames = ["Ananya", "Rohit", "Sakshi", "Aditya", "Mehul", "Diya", "Harsh", "Anushka"];
const surnames = ["Saini", "Saxena", "Rathore", "Jain", "Bansal", "Choudhary"];

for (const [batchIndex, batch] of batches.entries()) {
  for (let row = 0; row < 3; row++) {
    const index = batchIndex * 3 + row;
    const discount = index === 0 ? 1200000 : 0;
    const count = batch.name.startsWith("JEE") ? 4 : 3;
    const amount = (12000000 - discount) / count;
    students.push({
      code: `STU-${1001 + index}`, name: `${firstNames[index % firstNames.length]} ${surnames[(index + row) % surnames.length]}`,
      batch: batch.name, centreId: batch.centreId, phone: `+9190001${String(index + 1).padStart(5, "0")}`,
      language: index % 3 === 0 ? "en" : "hi", enrolledOn: "2026-04-01", discount,
      paid: Array.from({ length: count }, (_, seq) => seq === count - 1 ? 0 : row === 2 && seq === 1 ? 0 : amount),
    });
  }
}
