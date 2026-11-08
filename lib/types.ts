export type Language = "hi" | "en";

export interface ReceiptSummaryVM { id: string; number: string; issuedOn: string; amount: number }
export interface ReceiptVM extends ReceiptSummaryVM {
  student: { code: string; name: string; batch: string; centre: string };
  method: string; taxable: number; cgst: number; sgst: number;
}

export interface ProgressVM {
  attendance: { weekStart: string; attended: number; held: number }[];
  tests: { testDate: string; testName: string; score: number; maxScore: number }[];
}

export interface StudentInfoVM {
  code: string; name: string; batch: string; centre: string; status: "active" | "withdrawn";
  enrolledOn: string; guardianPhone: string; preferredLanguage: Language;
  course: { exam: "JEE" | "NEET"; examYear: string; timing: "Morning" | "Evening"; sessionStart: string; sessionEnd: string; instalments: number };
}

export interface InstalmentVM {
  id: string; seq: number; dueDate: string; amount: number; paid: number; balance: number;
  status: "paid" | "overdue" | "due_today" | "upcoming";
  partPaid: boolean; daysOverdue: number; dueInDays: number;
  payUrl: string | null;
}

export interface DuesVM {
  children: { studentId: string; fullName: string }[];
  selectedStudentId: string;
  mode: "pay" | "clear" | "review" | "withdrawn";
  current: InstalmentVM | null;      // oldest unpaid
  next: { amount: number; dueDate: string } | null;
  moreUnpaid: number;
  instalments: InstalmentVM[];
  refund: { amount: number; stillPayable: number; status: "draft" | "approved" | "paid"; deadline: string } | null;
}

export interface DashboardVM {
  today: string; canPickCentre: boolean;
  totals: { outstanding: number; overdue: number; over60Pct: number; refundsDue: number; refundsLate: number };
  rows: AgeingRow[];
  students?: { code: string; name: string; balance: number; daysOverdue: number }[];
}

export type StudentStatus = "overdue" | "upcoming" | "clear" | "checking" | "withdrawn";
export interface StudentFilters { status?: StudentStatus | "over60"; centre?: string; batch?: string; q?: string; page?: number }
export interface StudentRowVM {
  id: string; code: string; name: string; batch: string; centre: string; status: StudentStatus; balance: number; daysOverdue: number;
  next: string | null; stopped: string | null; lastPayment: { on: string; method: string } | null;
}
export interface StudentsVM {
  today: string; canPickCentre: boolean; rows: StudentRowVM[]; page: number; pages: number;
  counts: Record<StudentStatus | "all" | "over60", number>;
}

export interface AgeingRow {
  id: string; label: string; kind: "centre" | "batch"; studentsWithDues: number; outstanding: number;
  notDue: number; d1_30: number; d31_60: number; d61_90: number; d90p: number; children?: AgeingRow[];
}

export interface LedgerVM {
  student: { id: string; code: string; name: string; batch: string; centre: string; status: "active" | "withdrawn" };
  plan: { gross: number; discount: number; discountReason: string | null; net: number; paid: number; balance: number };
  instalments: InstalmentVM[];
  payments: { id: string; on: string; method: string; amount: number; receiptId: string | null }[];
  timeline: { instalmentId: string; sent: { step: number; on: string; language: "hi" | "en" }[];
              next: { step: number; on: string } | null; stopped: string | null }[];
  refund: { id: string; status: string } | null;
  guardianPhone: string;
}

export interface RefundVM {
  student: { code: string; name: string }; policy: { version: string };
  input: { withdrawalDate: string | null; reason: string | null };
  calc: RefundResult | null;   // see B8.5
  status: "new" | "draft" | "approved" | "paid";
  blockedBy: { unmatchedId: string; amount: number } | null;
  overdueDeadline: boolean;
}

export interface AutomationVM {
  today: string; demo: boolean; unmatchedOpen: number;
  sent: ReminderRow[]; upcoming: ReminderRow[]; stopped: ReminderRow[]; needsCall: ReminderRow[];
  unmatched: { id: string; receivedOn: string; amount: number; reference: string | null;
    reason: "unknown_reference" | "amount_mismatch" | "already_paid" | "student_withdrawn" | "excess_counter_payment";
    suggested: { instalmentId: string; studentCode: string; studentName: string } | null;
    status: "open" | "matched" | "rejected"; resolvedBy: string | null }[];
}

export interface AutomationCountsVM { unmatchedOpen: number; needsCall: number }
export type AutomationList = "sent" | "upcoming" | "stopped" | "needsCall" | "unmatched";
export interface AutomationPageVM extends AutomationVM {
  list: AutomationList; page: number; pageSize: number; total: number; totalPages: number;
}

export interface ReminderRow {
  instalmentId: string; studentCode: string; studentName: string; step: number | null; on: string | null;
  language: "hi" | "en"; amount: number; body: string | null; stoppedReason: string | null;
}

export interface CounsellorVM {
  accuracy: { genuine: number; total: number };
  open: TaskRow[]; closed: TaskRow[];
  watch: { studentCode: string; studentName: string; batch: string; score: number; reasons: string[] }[];
  unknown: { studentCode: string; studentName: string; batch: string; missing: string }[];
}

export interface TaskRow {
  id: string; studentCode: string; studentName: string; batch: string; guardianPhone: string;
  score: number; band: "high"; reasons: string[];
  brief: string; briefSource: "llm" | "template"; createdOn: string;
  status: "open" | "called" | "false_flag"; note: string | null;
}

export interface RefundResult {
  totalDays: number; elapsedDays: number; earned: number; refund: number;
  stillPayable: number; deadline: string;
  taxable: number; cgst: number; sgst: number;   // GST split of refund
}

// Admin Manage section (assumption beyond the brief, see docs/progress.md). Django decides every flag below; screens only show them.
export type ManageEntity = "student" | "batch" | "centre" | "staff";
export type RecordState = "active" | "archived";
export interface RecordActions {
  canEdit: boolean; canArchive: boolean; canRestore: boolean; canDelete: boolean;
  blockedReason: string | null;   // why archive or delete is not offered, e.g. "Move its 12 students to another batch first."
}
export interface AdminCentreVM { id: string; code: string; name: string; state: RecordState; batches: number; students: number; staff: number; actions: RecordActions }
export interface AdminBatchVM {
  id: string; name: string; centreId: string; centre: string; stream: "JEE" | "NEET";
  sessionStart: string; sessionEnd: string; state: RecordState; students: number; actions: RecordActions;
}
export interface AdminStaffVM {
  id: string; fullName: string; email: string; role: "accounts" | "counsellor" | "admin";
  centreId: string | null; centre: string | null; state: RecordState; actions: RecordActions;
}
export interface AdminStudentVM {
  id: string; code: string; name: string; batchId: string; batch: string; centreId: string; centre: string;
  status: "active" | "withdrawn"; state: RecordState; enrolledOn: string;
  guardian: { name: string; phone: string; language: Language };
  fee: { gross: number; discount: number; discountReason: string | null; net: number; paid: number; editable: boolean; lockedReason: string | null };
  actions: RecordActions;
}
export interface AdminFilters { q?: string; centre?: string; batch?: string; state?: RecordState; page?: number }
export interface AdminListVM<T> { today: string; rows: T[]; page: number; pages: number; counts: Record<RecordState, number> }
export interface AdminDirectoryVM { centres: { id: string; name: string }[]; batches: { id: string; name: string; centreId: string }[] }
export interface ChangeVM {
  id: string; at: string;           // ISO date-time
  actor: string; action: "create" | "update" | "fee" | "archive" | "restore" | "delete";
  entity: ManageEntity; entityId: string; label: string;
  changes: { field: string; before: string | number | null; after: string | number | null }[];   // money fields in paise; batchId and centreId values are display names
  reason: string | null;
}
export interface ChangeFilters { entity?: ManageEntity; id?: string; page?: number }

export type SearchParams = Record<string, string | string[] | undefined>;
