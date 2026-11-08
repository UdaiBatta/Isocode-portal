"use client";

import { useState, type ReactNode } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { cx } from "@/utils/cx";

/** Product rows use the installed table primitives and TanStack sorting. */
export function DataTable<T extends { id: string }>({ data, columns, label, renderCard, rowClassName }: { data: T[]; columns: ColumnDef<T>[]; label: string; renderCard: (row: T) => ReactNode; rowClassName?: (row: T) => string | undefined }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const numeric = (column: { columnDef: ColumnDef<T> }) => (column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
  return <div className="@container">
    <div className="hidden overflow-x-auto @3xl:block"><Table aria-label={label} size="sm"><TableHeader>{table.getFlatHeaders().map((header, i) => <TableColumn key={header.id} id={header.id} isRowHeader={i === 0}><button type="button" onClick={header.column.getToggleSortingHandler()} className={cx("min-h-11 whitespace-nowrap text-body-2-medium text-text-primary", numeric(header.column) && "block w-full text-end")}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}</button></TableColumn>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.original.id} id={row.original.id} className={rowClassName?.(row.original)}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}><div className={cx("text-body-2-regular text-text-primary", numeric(cell.column) && "text-end")}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div></TableCell>)}</TableRow>)}</TableBody></Table></div>
    <ul className="flex flex-col divide-y divide-separator-border @3xl:hidden" aria-label={label}>{table.getRowModel().rows.map((row) => <li key={row.original.id} className={cx("py-5", rowClassName?.(row.original))}>{renderCard(row.original)}</li>)}</ul>
  </div>;
}
