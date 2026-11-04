"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiPhoneLine } from "@remixicon/react";
import type { ColumnDef } from "@tanstack/react-table";
import { StatCards } from "@/components/application/dashboard/stat-cards";
import { DataTable } from "@/components/application/data-table/data-table";
import { Tabs, TabList, Tab, TabPanel } from "@/components/base/tabs/tabs";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Drawer, DrawerHeader, DrawerBody } from "@/components/base/drawer/drawer";
import { RadioGroup, Radio } from "@/components/base/radio/radio";
import { Textarea } from "@/components/base/textarea/textarea";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { toast } from "@/components/base/toast/toast";
import { ensureCallBrief, closeTask } from "@/lib/actions/counsellor";
import type { CounsellorVM, TaskRow } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { EmptyState } from "./EmptyState";
import { StaffFrame, StaffPageHeader } from "./StaffPage";

type RiskRow = { id: string; studentCode: string; studentName: string; batch: string; score?: number; reasons?: string[]; missing?: string; task?: TaskRow };
export function CounsellorTasks({ view, tab }: { view: CounsellorVM; tab: "calls" | "watch" | "unknown" }) {
  const router = useRouter();
  const [closed, setClosed] = useState(false);
  const [task, setTask] = useState<TaskRow | null>(null);
  const [summary, setSummary] = useState<{ brief: string; briefSource: "llm" | "template" } | null>(null);
  const [outcome, setOutcome] = useState<"called" | "false_flag">("called");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const requestedTask = useRef<string | null>(null);
  async function openTask(row: TaskRow) {
    requestedTask.current = row.id; setTask(row); setSummary({ brief: row.brief, briefSource: row.briefSource }); setNote(row.note ?? ""); setOutcome(row.status === "false_flag" ? "false_flag" : "called"); setError("");
    try { const result = await ensureCallBrief({ taskId: row.id }); if (result.ok && requestedTask.current === row.id) setSummary({ brief: result.brief, briefSource: result.briefSource }); } catch { /* The supplied standard summary remains available. */ }
  }
  const rows: RiskRow[] = tab === "calls" ? (closed ? view.closed : view.open).map((row) => ({ ...row, task: row })) : tab === "watch" ? view.watch.map((row) => ({ ...row, id: row.studentCode })) : view.unknown.map((row) => ({ ...row, id: row.studentCode }));
  const columns: ColumnDef<RiskRow>[] = [
    { accessorKey: "studentName", header: "Student", cell: ({ row }) => row.original.task ? <LinkButton variant="secondary" onClick={() => openTask(row.original.task!)}>{row.original.studentName}</LinkButton> : row.original.studentName },
    { accessorKey: "batch", header: "Batch" },
    { accessorKey: "score", header: "Flag", cell: ({ row }) => <div className="flex items-center gap-2"><StatusChip status={tab === "unknown" ? "insufficient" : tab === "watch" ? "watch" : "high"} />{row.original.score === undefined ? null : <span className="tabular-nums">{row.original.score}</span>}</div> },
    { id: "reason", header: "Reasons", cell: ({ row }) => row.original.missing ?? row.original.reasons?.join("; ") },
  ];
  return <>
    <StaffPageHeader title="Counsellor calls" description="A flag asks for a conversation. Record what you learn." />
    <StaffFrame>
    <StatCards columns={1} stats={[{ icon: RiPhoneLine, label: "Flag accuracy so far", value: view.accuracy.total ? `${Math.round(view.accuracy.genuine / view.accuracy.total * 100)}%` : "—", delta: view.accuracy.total ? `${view.accuracy.genuine} of ${view.accuracy.total} genuine` : "No outcomes yet", deltaColor: "neutral" }]} />
    <section><Tabs selectedKey={tab} onSelectionChange={(key) => router.push(`/counsellor/tasks?tab=${key}`)}><TabList aria-label="Counsellor views"><Tab id="calls">Call tasks</Tab><Tab id="watch">Watch</Tab><Tab id="unknown">Not enough data</Tab></TabList>
      {(["calls", "watch", "unknown"] as const).map((key) => <TabPanel id={key} key={key}><div className="flex flex-col gap-6">{key === "calls" ? <SegmentedControl aria-label="Call status" selectedKeys={[closed ? "closed" : "open"]} onSelectionChange={(keys) => setClosed(Array.from(keys)[0] === "closed")}><SegmentedControlItem id="open">Open</SegmentedControlItem><SegmentedControlItem id="closed">Closed</SegmentedControlItem></SegmentedControl> : null}{rows.length ? <DataTable label="Student support flags" data={rows} columns={columns} renderCard={(row) => <div className="flex flex-col gap-3">{row.task ? <LinkButton variant="secondary" onClick={() => openTask(row.task!)}>{row.studentName}</LinkButton> : <p className="text-body-medium">{row.studentName}</p>}<p className="text-body-regular text-text-secondary">{row.batch}</p><div className="flex items-center gap-3"><StatusChip status={tab === "unknown" ? "insufficient" : tab === "watch" ? "watch" : "high"} />{row.score ?? ""}</div><p className="text-body-regular">{row.missing ?? row.reasons?.join("; ")}</p></div>} /> : <EmptyState title={closed && key === "calls" ? "No closed call tasks" : "No students in this view"} />}</div></TabPanel>)}
    </Tabs></section></StaffFrame>
    <Drawer isOpen={!!task} onOpenChange={(open) => { if (!open) { requestedTask.current = null; setTask(null); } }} aria-label="Counsellor call"><DrawerHeader title={task?.studentName ?? "Call task"} description={task?.batch} /><DrawerBody>{task ? <div className="flex flex-col gap-6"><div className="flex gap-3"><StatusChip status="high" /><span className="text-body-medium">Score {task.score}</span></div><ul className="list-disc space-y-2 ps-5 text-body-regular">{task.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><section className="flex flex-col gap-2"><h2 className="text-headline-medium">{summary?.briefSource === "llm" ? "AI-written summary" : "Standard summary"}</h2><p className="text-body-regular">{summary?.brief ?? task.brief}</p></section><LinkButton href={`tel:${task.guardianPhone}`} variant="secondary">Call parent · {task.guardianPhone}</LinkButton>{task.status === "open" ? <><RadioGroup aria-label="Call outcome" value={outcome} onChange={(value) => setOutcome(value as typeof outcome)}><Radio value="called">Called, genuine concern</Radio><Radio value="false_flag">False flag</Radio></RadioGroup><Textarea label="Call note" hint={outcome === "false_flag" ? "Required for a false flag." : "What should the next counsellor know?"} value={note} onChange={setNote} maxLength={300} /><Button disabled={pending} onClick={() => { setError(""); if (outcome === "false_flag" && !note.trim()) { setError("Explain why this was a false flag."); return; } startTransition(async () => { try { const result = await closeTask({ taskId: task.id, outcome, note }); if (!result.ok) { setError(result.message); return; } toast.success("Call outcome saved"); requestedTask.current = null; setTask(null); router.refresh(); } catch { setError("Could not save the call outcome. Please try again."); } }); }}>Save outcome</Button>{error ? <p role="alert" className="text-body-regular text-text-error-primary">{error}</p> : null}</> : <section><h2 className="text-headline-medium">{task.status === "false_flag" ? "False flag" : "Called, genuine concern"}</h2><p className="mt-2 text-body-regular">{task.note || "No note recorded."}</p></section>}</div> : null}</DrawerBody></Drawer>
  </>;
}
