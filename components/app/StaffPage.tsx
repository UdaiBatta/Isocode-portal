import type { ReactNode } from "react";

// Title and purpose first, then the working area in one framed surface, so every management screen reads the same way.
export function StaffPageHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <header className="staff-reveal flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
    <div className="flex max-w-2xl flex-col gap-2"><h1 className="text-title-1-medium text-balance">{title}</h1><p className="max-w-md text-body-regular text-balance text-text-secondary">{description}</p></div>
    {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
  </header>;
}

export function StaffFrame({ children }: { children: ReactNode }) {
  return <div className="staff-reveal flex flex-col gap-4 [&>section]:flex [&>section]:flex-col [&>section]:gap-4 [&>section]:rounded-3xl [&>section]:border [&>section]:border-border-button-default [&>section]:bg-background-primary-default [&>section]:p-4 md:[&>section]:p-5">{children}</div>;
}
