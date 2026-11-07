import { ButtonLink } from "@/components/base/buttons/button";

// Plain download links: the browser saves the file the export route returns. Django rechecks role and centre scope.
export function ExportButtons({ filters }: { filters: { centre?: string; batch?: string } }) {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
  const href = (file: string) => `/staff/export/${file}${query ? `?${query}` : ""}`;
  return <div role="group" aria-label="Export accounts data" className="flex flex-wrap gap-2">
    <ButtonLink variant="secondary" href={href("dues.csv")} download>Export dues CSV</ButtonLink>
    <ButtonLink variant="secondary" href={href("receipts.csv")} download>Export receipts CSV</ButtonLink>
  </div>;
}
