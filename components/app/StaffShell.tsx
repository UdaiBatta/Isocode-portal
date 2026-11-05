"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RiBuilding2Line, RiCalendarScheduleLine, RiDashboardLine, RiGroupLine, RiHistoryLine, RiNotification3Line, RiPhoneLine, RiUserSettingsLine } from "@remixicon/react";
import { WorkspaceSidebar } from "@/components/application/dashboard/dashboard-sidebar";
import { Drawer, DrawerHeader, DrawerBody } from "@/components/base/drawer/drawer";
import { Button } from "@/components/base/buttons/button";
import { LogoutButton } from "./LogoutButton";
import { Toaster } from "@/components/base/toast/toast";

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
  ];
  const nav = <WorkspaceSidebar items={items} selected={admin ? manage.find((item) => path.startsWith(item.href))?.key ?? "students" : counsellor ? "calls" : path.includes("automation") ? "automation" : path.includes("students") ? "students" : "dashboard"} footer={<LogoutButton language="en" />} />;
  return <div lang="en" className="staff-surface min-h-screen p-4 text-text-primary md:flex md:gap-8 md:p-0">
    <div className="hidden w-60 shrink-0 md:block"><div className="staff-spine ledger-butti sticky top-0 h-dvh">{nav}</div></div>
    <div className="mb-6 md:hidden"><Button variant="secondary" onClick={() => setOpen(true)}>Menu</Button></div>
    <Drawer isOpen={open} onOpenChange={setOpen} placement="start" aria-label="Workspace navigation"><DrawerHeader title="Workspace" /><DrawerBody>{nav}</DrawerBody></Drawer>
    <main className="mx-auto flex w-full min-w-0 max-w-[1200px] flex-col gap-8 py-3 md:py-8 md:pe-8">{children}</main><Toaster />
  </div>;
}
