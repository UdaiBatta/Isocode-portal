import { RiDownload2Line } from "@remixicon/react";
import { LinkButton } from "@/components/base/buttons/link-button";
import type { InvoiceRow } from "@/lib/data/receipts";

export type InvoiceLabels = Record<"date" | "description" | "amount" | "status" | "action" | "paid" | "pending" | "download" | "label", string>;
type InvoiceView = Omit<InvoiceRow, "amount" | "issuedOn" | "method"> & { amount: string; date: string; description: string };

function InvoiceStatus({ row, labels }: { row: InvoiceView; labels: InvoiceLabels }) {
  return <span className={row.status === "paid" ? "ledger-stamp ledger-stamp-small ledger-stamp-paid" : "ledger-stamp ledger-stamp-small"}>{labels[row.status]}</span>;
}

function InvoiceDownload({ row, labels }: { row: InvoiceView; labels: InvoiceLabels }) {
  return row.href ? <LinkButton href={row.href} variant="secondary" aria-label={`${labels.download} ${row.number}`}><span className="inline-flex items-center gap-1.5"><RiDownload2Line aria-hidden className="size-4" />{labels.download}</span></LinkButton> : null;
}

// A read-only list on BoardUI's table styles. It has no sorting or selection, so it stays server-rendered and ships none of the 42 KB interactive Table to phones.
export function InvoiceTable({ rows, labels }: { rows: InvoiceView[]; labels: InvoiceLabels }) {
  return <>
    <div className="hidden overflow-x-auto md:block"><table aria-label={labels.label} className="bui-table w-full">
      <thead><tr>{[labels.date, labels.description, labels.amount, labels.status, labels.action].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>
        <td><span className="flex flex-col"><span className="text-body-medium">{row.date}</span><bdi className="text-body-regular text-text-secondary">{row.number}</bdi></span></td>
        <td>{row.description}</td>
        <td><span className="ledger-figure">{row.amount}</span></td>
        <td><InvoiceStatus row={row} labels={labels} /></td>
        <td><InvoiceDownload row={row} labels={labels} /></td>
      </tr>)}</tbody>
    </table></div>
    <ul aria-label={labels.label} className="flex flex-col divide-y divide-separator-border md:hidden">{rows.map((row) => <li key={row.id} className="flex flex-col gap-2 py-4">
      <span className="flex items-baseline justify-between gap-4"><span className="text-headline-medium">{row.date}</span><span className="ledger-figure">{row.amount}</span></span>
      <span className="text-body-regular text-text-secondary">{row.description}</span>
      <bdi className="text-body-regular text-text-secondary">{row.number}</bdi>
      <span className="flex items-center justify-between gap-4"><InvoiceStatus row={row} labels={labels} /><InvoiceDownload row={row} labels={labels} /></span>
    </li>)}</ul>
  </>;
}
