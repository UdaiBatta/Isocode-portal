"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RiBuilding2Line, RiCalendarScheduleLine, RiDashboardLine, RiGroupLine, RiHistoryLine, RiNotification3Line, RiPhoneLine, RiUserSettingsLine, RiUploadCloud2Line } from "@remixicon/react";
import { Drawer, DrawerHeader, DrawerBody } from "@/components/base/drawer/drawer";
import { Button } from "@/components/base/buttons/button";
import { LogoutButton } from "./LogoutButton";
import { Toaster } from "@/components/base/toast/toast";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { cx } from "@/utils/cx";

const manage = [
  { key: "students", label: "Students", icon: RiGroupLine, href: "/staff/manage/students" },
  { key: "batches", label: "Batches", icon: RiCalendarScheduleLine, href: "/staff/manage/batches" },
  { key: "centres", label: "Centres", icon: RiBuilding2Line, href: "/staff/manage/centres" },
  { key: "staff", label: "Staff", icon: RiUserSettingsLine, href: "/staff/manage/staff" },
  { key: "history", label: "Change history", icon: RiHistoryLine, href: "/staff/manage/history" },
];

export function StaffShell({ children, counsellor = false, admin = false }: { children: ReactNode; counsellor?: boolean; admin?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = admin ? manage : counsellor ? [{ key: "calls", label: "Call tasks", icon: RiPhoneLine, href: "/counsellor/tasks" }] : [
    { key: "dashboard", label: "Dashboard", icon: RiDashboardLine, href: "/staff/dashboard" },
    { key: "students", label: "Students", icon: RiGroupLine, href: "/staff/students" },
    { key: "automation", label: "Automation", icon: RiNotification3Line, href: "/staff/automation" },
    { key: "upload", label: "Upload results", icon: RiUploadCloud2Line, href: "/staff/upload" },
  ];
  const selected = admin ? manage.find((item) => path.startsWith(item.href))?.key ?? "students" : counsellor ? "calls" : path.includes("automation") ? "automation" : path.includes("/upload") ? "upload" : path.includes("students") ? "students" : "dashboard";
  const nav = <aside className="flex h-full w-full flex-col gap-10 rounded-3xl bg-background-secondary-default p-5">
    <div><p className="text-headline-medium">Company A</p><p className="text-body-regular text-text-secondary">Jaipur · Coaching</p></div>
    <nav aria-label="Workspace" className="flex flex-col gap-2">{items.map(({ key, label, icon: Icon, href }) => <a key={key} href={href} aria-current={selected === key ? "page" : undefined} className={cx("flex w-full items-center gap-2 overflow-hidden rounded-2lg p-2 transition-[background-color] duration-300 ease-in-out", selected === key ? "bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected" : "hover:bg-background-secondary-hover")}>
      <Icon className={cx("size-5 shrink-0", selected === key ? "text-text-white" : "text-foreground-icon-secondary")} aria-hidden />
      <span className={cx("min-w-0 overflow-hidden text-body-medium whitespace-nowrap", selected === key ? "text-text-white" : "text-text-secondary")}>{label}</span>
    </a>)}</nav>
    <div className="mt-auto"><LogoutButton language="en" /></div>
  </aside>;
  // Staff screens are English, so date pickers and other React Aria controls use an English locale even when the root is Hindi.
  return <DirectionProvider locale="en-IN"><div className="staff-surface min-h-screen p-4 text-text-primary md:flex md:gap-8 md:p-0">
    <div className="hidden w-60 shrink-0 md:block"><div className="staff-spine ledger-butti sticky top-0 h-dvh">{nav}</div></div>
    <div className="mb-6 md:hidden"><Button variant="secondary" onClick={() => setOpen(true)}>Menu</Button></div>
    <Drawer isOpen={open} onOpenChange={setOpen} placement="start" aria-label="Workspace navigation"><DrawerHeader title="Workspace" /><DrawerBody>{nav}</DrawerBody></Drawer>
    <main className="mx-auto flex w-full min-w-0 max-w-[1200px] flex-col gap-8 py-3 md:py-8 md:pe-8">{children}</main><Toaster />
  </div></DirectionProvider>;
}
