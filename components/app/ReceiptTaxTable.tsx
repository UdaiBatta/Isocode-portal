"use client";

import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@/components/base/table/table";
import { inr } from "@/lib/format";
import { t, type TranslationKey } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function ReceiptTaxTable({ amounts, language }: { amounts: { taxable: number; cgst: number; sgst: number; amount: number }; language: Language }) {
  const rows: { id: string; label: TranslationKey; amount: number }[] = [
    { id: "taxable", label: "receipt.taxable", amount: amounts.taxable },
    { id: "cgst", label: "receipt.cgst", amount: amounts.cgst },
    { id: "sgst", label: "receipt.sgst", amount: amounts.sgst },
    { id: "total", label: "receipt.total", amount: amounts.amount },
  ];
  return <Table aria-label={t(language, "receipt.taxable")} size="sm">
    <TableHeader><TableColumn id="label" isRowHeader><span className="text-body-medium text-text-primary">{t(language, "receipt.item")}</span></TableColumn><TableColumn id="amount"><span className="block text-end text-body-medium text-text-primary">{t(language, "receipt.amount")}</span></TableColumn></TableHeader>
    <TableBody>{rows.map((row) => <TableRow key={row.id} id={row.id}><TableCell><span className="text-body-regular">{t(language, row.label)}</span></TableCell><TableCell><span className="block text-end text-body-medium tabular-nums">{inr(row.amount)}</span></TableCell></TableRow>)}</TableBody>
  </Table>;
}
