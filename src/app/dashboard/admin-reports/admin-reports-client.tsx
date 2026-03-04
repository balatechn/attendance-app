"use client";

import { useState, useCallback, useMemo } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Button, Card, Badge, Input, Select } from "@/components/ui";
import { STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────
interface Department { id: string; name: string }
interface EntityOption { id: string; name: string }
interface LocationOption { id: string; name: string; entityId: string | null }

interface AttendanceSummary {
  id: string; name: string; employeeCode: string; department: string; role?: string;
  totalDays: number; presentDays: number; absentDays: number; lateDays: number;
  halfDays: number; onLeaveDays: number; totalWorkHours: number; avgDailyHours: number; totalOTHours: number;
}

interface DailyAttendance {
  id: string; name: string; employeeCode: string; department: string; status: string;
  firstCheckIn: string; lastCheckOut: string; checkInLocation: string; checkOutLocation: string;
  checkInNote: string; checkOutNote: string; workHours: number; breakHours: number;
  sessions: number; isLate: boolean;
  regApplied: boolean; regType: string; regStatus: string; regReason: string;
  leaveApplied: boolean; leaveType: string; leaveStatus: string;
}

interface DetailedLogEntry {
  employeeId: string; name: string; employeeCode: string; designation: string;
  department: string; shift: string; date: string; dayName: string; status: string;
  checkIn: string; checkOut: string; checkInLocation: string; checkOutLocation: string;
  checkInNote: string; checkOutNote: string; workHours: number; breakHours: number;
  otHours: number; sessions: number; isAutoOut: boolean;
  regApplied: boolean; regType: string; regStatus: string; regReason: string;
  leaveApplied: boolean; leaveType: string; leaveStatus: string;
}

interface WeeklyEntry {
  employeeId: string; name: string; employeeCode: string; department: string;
  weekLabel: string; weekStart: string;
  presentDays: number; absentDays: number; lateDays: number; halfDays: number;
  leaveDays: number; totalWorkHours: number; totalOTHours: number; avgDailyHours: number;
}

interface PayrollEntry {
  id: string; name: string; employeeCode: string; designation: string;
  department: string; shift: string; totalWorkingDays: number;
  presentDays: number; absentDays: number; lateDays: number; halfDays: number;
  leaveDays: number; effectiveDays: number; totalWorkHours: number; totalOTHours: number;
  avgDailyHours: number; shortHoursDays: number;
  regsApproved: number; regsPending: number;
  leaveBreakdown: Array<{ type: string; days: number }>;
  leaveBalance: Array<{ type: string; allocated: number; used: number; balance: number }>;
}

interface LateArrival {
  id: string; name: string; employeeCode: string; department: string;
  shift: string; lateDays: number; dates: Array<{ date: string; checkIn: string }>;
}

interface OvertimeData {
  id: string; name: string; employeeCode: string; department: string;
  otDays: number; totalOTHours: number; avgOTPerDay: number;
  dates: Array<{ date: string; otHours: number }>;
}

interface LeaveData {
  id: string; name: string; employeeCode: string; department: string;
  balances: Array<{ leaveType: string; code: string; allocated: number; used: number; pending: number; balance: number }>;
  totalAllocated: number; totalUsed: number; totalPending: number; totalBalance: number;
}

interface RegEntry {
  id: string; employeeName: string; employeeCode: string; department: string;
  date: string; type: string; reason: string; requestedTime: string;
  status: string; reviewer: string; reviewNote: string; createdAt: string;
}

interface DiscrepancyEntry {
  employeeId: string; name: string; employeeCode: string; department: string;
  date: string; type: string; detail: string; hasReg: boolean; regStatus: string;
}

interface DailyEmailEntity {
  entityId: string; entityName: string; total: number; present: number; absent: number; late: number;
  locations: Array<{
    locationId: string; locationName: string; total: number; present: number; absent: number;
    employees: Array<{
      id: string; name: string; employeeCode: string | null; department: string;
      status: string; firstCheckIn: string | null; lastCheckOut: string | null;
      workHours: string; overtimeMins: number;
    }>;
  }>;
}

interface DailyEmailReport {
  date: string; displayDate: string;
  stats: { total: number; present: number; absent: number; late: number };
  entities: DailyEmailEntity[];
}

// ─── Report Menu Config ───────────────────────────────────
type ReportKey =
  | "attendance-summary" | "daily-attendance" | "detailed-log"
  | "weekly-report" | "monthly-payroll"
  | "late-arrivals" | "overtime" | "leave-summary"
  | "regularization" | "discrepancy" | "daily-email";

interface ReportCategory {
  label: string;
  items: { key: ReportKey; label: string; icon: string; desc: string }[];
}

const REPORT_MENU: ReportCategory[] = [
  {
    label: "Overview",
    items: [
      { key: "attendance-summary", label: "Attendance Summary", icon: "📊", desc: "Present/absent/late counts per employee" },
      { key: "daily-attendance", label: "Daily View", icon: "📅", desc: "Single day detailed attendance with reg & leave" },
    ],
  },
  {
    label: "Detailed Reports",
    items: [
      { key: "detailed-log", label: "Detailed Attendance Log", icon: "📋", desc: "Day-by-day log with time, location, notes, reg, leave" },
      { key: "regularization", label: "Regularization Report", icon: "📝", desc: "All regularization requests with approval status" },
      { key: "discrepancy", label: "Discrepancy Report", icon: "⚠️", desc: "Missing check-outs, short hours, absent without leave" },
    ],
  },
  {
    label: "Period Reports",
    items: [
      { key: "weekly-report", label: "Weekly Report", icon: "📆", desc: "Week-by-week aggregated attendance" },
      { key: "monthly-payroll", label: "Monthly / Payroll", icon: "💰", desc: "Monthly summary for payroll with effective days & leave" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { key: "late-arrivals", label: "Late Arrivals", icon: "⏰", desc: "Employees ranked by late frequency" },
      { key: "overtime", label: "Overtime", icon: "🕐", desc: "OT hours per employee with daily breakdown" },
      { key: "leave-summary", label: "Leave Summary", icon: "🏖️", desc: "Leave balances per employee per type" },
    ],
  },
  {
    label: "Email",
    items: [
      { key: "daily-email", label: "Daily Email Report", icon: "📧", desc: "Entity-wise daily summary email" },
    ],
  },
];

const ALL_REPORTS = REPORT_MENU.flatMap((c) => c.items);

// ─── Main Component ───────────────────────────────────────
export function AdminReportsClient({
  departments, entities, locations,
}: {
  departments: Department[];
  entities: EntityOption[];
  locations: LocationOption[];
}) {
  const [activeReport, setActiveReport] = useState<ReportKey>("attendance-summary");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [department, setDepartment] = useState("");
  const [entity, setEntity] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Data states
  const [attendanceData, setAttendanceData] = useState<AttendanceSummary[]>([]);
  const [dailyData, setDailyData] = useState<DailyAttendance[]>([]);
  const [detailedLogData, setDetailedLogData] = useState<DetailedLogEntry[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyEntry[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [lateData, setLateData] = useState<LateArrival[]>([]);
  const [overtimeData, setOvertimeData] = useState<OvertimeData[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveData[]>([]);
  const [regData, setRegData] = useState<{ stats: { total: number; approved: number; pending: number; rejected: number }; data: RegEntry[] } | null>(null);
  const [discrepancyData, setDiscrepancyData] = useState<{ stats: { total: number; missingCheckout: number; absentNoLeave: number; shortHours: number; lateNoReg: number }; data: DiscrepancyEntry[] } | null>(null);
  const [dailyEmailData, setDailyEmailData] = useState<DailyEmailReport | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState("");

  const filteredLocations = entity ? locations.filter((l) => l.entityId === entity) : locations;
  const activeReportInfo = ALL_REPORTS.find((r) => r.key === activeReport)!;

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      if (activeReport === "daily-email") {
        const res = await fetch(`/api/reports/daily-email?date=${startDate}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to fetch");
        setDailyEmailData(json.data);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ type: activeReport, start: startDate, end: endDate });
      if (department) params.set("department", department);
      if (entity) params.set("entity", entity);
      if (location) params.set("location", location);

      const res = await fetch(`/api/reports/admin?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");

      switch (activeReport) {
        case "attendance-summary": setAttendanceData(json.data); break;
        case "daily-attendance": setDailyData(json.data); break;
        case "detailed-log": setDetailedLogData(json.data); break;
        case "weekly-report": setWeeklyData(json.data); break;
        case "monthly-payroll": setPayrollData(json.data); break;
        case "late-arrivals": setLateData(json.data); break;
        case "overtime": setOvertimeData(json.data); break;
        case "leave-summary": setLeaveData(json.data); break;
        case "regularization": setRegData(json.data); break;
        case "discrepancy": setDiscrepancyData(json.data); break;
      }
    } catch {
      /* error */
    } finally {
      setLoading(false);
    }
  }, [activeReport, startDate, endDate, department, entity, location]);

  const handleExport = async () => {
    if (activeReport === "daily-email") return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ type: activeReport, start: startDate, end: endDate, export: "excel" });
      if (department) params.set("department", department);
      if (entity) params.set("entity", entity);
      if (location) params.set("location", location);

      const res = await fetch(`/api/reports/admin?${params}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeReport}-${startDate}-to-${endDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* */ } finally {
      setExporting(false);
    }
  };

  const handleSendDailyEmail = async () => {
    setSendingEmail(true);
    setEmailSent("");
    try {
      const res = await fetch("/api/reports/daily-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: startDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setEmailSent(`Sent ${json.data.sent}/${json.data.total} emails successfully!`);
    } catch (err) {
      setEmailSent(err instanceof Error ? err.message : "Failed to send emails");
    } finally {
      setSendingEmail(false);
    }
  };

  const setPreset = (days: number) => {
    const e = new Date();
    const s = subDays(e, days - 1);
    setStartDate(format(s, "yyyy-MM-dd"));
    setEndDate(format(e, "yyyy-MM-dd"));
  };

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-6rem)]">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 mb-3">
            Reports
          </h2>
          {REPORT_MENU.map((cat) => (
            <div key={cat.label}>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 pt-3 pb-1">
                {cat.label}
              </p>
              {cat.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setActiveReport(item.key); setHasSearched(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors",
                    activeReport === item.key
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 shadow-xl p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-900 dark:text-white">Reports</h2>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {REPORT_MENU.map((cat) => (
              <div key={cat.label} className="mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 pt-2 pb-1">{cat.label}</p>
                {cat.items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => { setActiveReport(item.key); setHasSearched(false); setSidebarOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2",
                      activeReport === item.key
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">{activeReportInfo.icon}</span>
              {activeReportInfo.label}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{activeReportInfo.desc}</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            {activeReport === "daily-email" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Report Date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={fetchReport} loading={loading} className="flex-1">View Report</Button>
                  <Button variant="outline" onClick={handleSendDailyEmail} loading={sendingEmail} disabled={!dailyEmailData}>
                    📧 Send Email
                  </Button>
                </div>
                <div className="flex items-end">
                  {emailSent && (
                    <p className={cn("text-sm font-medium", emailSent.startsWith("Failed") ? "text-red-500" : "text-green-600 dark:text-green-400")}>
                      {emailSent}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
                    <Select value={department} onChange={(e) => setDepartment(e.target.value)}
                      options={[{ value: "", label: "All Departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Entity</label>
                    <Select value={entity} onChange={(e) => { setEntity(e.target.value); setLocation(""); }}
                      options={[{ value: "", label: "All Entities" }, ...entities.map((en) => ({ value: en.id, label: en.name }))]} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
                    <Select value={location} onChange={(e) => setLocation(e.target.value)}
                      options={[{ value: "", label: "All Locations" }, ...filteredLocations.map((l) => ({ value: l.id, label: l.name }))]} />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={fetchReport} loading={loading} className="flex-1">Generate</Button>
                    <Button variant="outline" onClick={handleExport} loading={exporting} disabled={!hasSearched}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="hidden sm:inline ml-1">Excel</span>
                    </Button>
                  </div>
                </div>
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-400 self-center">Quick:</span>
                  {[{ label: "Today", days: 1 }, { label: "7 Days", days: 7 }, { label: "30 Days", days: 30 }].map((p) => (
                    <button key={p.label} onClick={() => setPreset(p.days)}
                      className="px-2 py-0.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      {p.label}
                    </button>
                  ))}
                  <button onClick={setThisMonth}
                    className="px-2 py-0.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    This Month
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Report Content */}
        {loading ? (
          <Card className="p-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </Card>
        ) : !hasSearched ? (
          <Card className="p-12 text-center">
            <p className="text-gray-400 dark:text-gray-500">Select filters and click &quot;Generate&quot; to view the report.</p>
          </Card>
        ) : (
          <>
            {activeReport === "attendance-summary" && <AttendanceSummaryTable data={attendanceData} />}
            {activeReport === "daily-attendance" && <DailyAttendanceTable data={dailyData} />}
            {activeReport === "detailed-log" && <DetailedLogView data={detailedLogData} />}
            {activeReport === "weekly-report" && <WeeklyReportTable data={weeklyData} />}
            {activeReport === "monthly-payroll" && <MonthlyPayrollTable data={payrollData} />}
            {activeReport === "late-arrivals" && <LateArrivalsTable data={lateData} />}
            {activeReport === "overtime" && <OvertimeTable data={overtimeData} />}
            {activeReport === "leave-summary" && <LeaveSummaryTable data={leaveData} />}
            {activeReport === "regularization" && regData && <RegularizationTable data={regData} />}
            {activeReport === "discrepancy" && discrepancyData && <DiscrepancyTable data={discrepancyData} />}
            {activeReport === "daily-email" && dailyEmailData && <DailyEmailReportView data={dailyEmailData} />}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// REPORT VIEW COMPONENTS
// ═══════════════════════════════════════════════════════════

// ─── Report 1: Attendance Summary ─────────────────────────
function AttendanceSummaryTable({ data }: { data: AttendanceSummary[] }) {
  if (data.length === 0) return <EmptyState />;
  const totals = data.reduce((acc, d) => ({
    totalDays: acc.totalDays + d.totalDays, presentDays: acc.presentDays + d.presentDays,
    absentDays: acc.absentDays + d.absentDays, lateDays: acc.lateDays + d.lateDays,
    halfDays: acc.halfDays + d.halfDays, onLeaveDays: acc.onLeaveDays + d.onLeaveDays,
    totalWorkHours: acc.totalWorkHours + d.totalWorkHours, totalOTHours: acc.totalOTHours + d.totalOTHours,
  }), { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, halfDays: 0, onLeaveDays: 0, totalWorkHours: 0, totalOTHours: 0 });

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Total Employees" value={data.length} />
        <StatCard label="Avg Present %" value={`${totals.totalDays > 0 ? Math.round((totals.presentDays / totals.totalDays) * 100) : 0}%`} color="green" />
        <StatCard label="Total Late Days" value={totals.lateDays} color="yellow" />
        <StatCard label="Total OT Hours" value={totals.totalOTHours.toFixed(1)} color="blue" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH className="text-center text-green-600">Present</TH>
              <TH className="text-center text-red-600">Absent</TH>
              <TH className="text-center text-yellow-600">Late</TH>
              <TH className="text-center text-orange-600 hidden lg:table-cell">Half</TH>
              <TH className="text-center text-purple-600 hidden lg:table-cell">Leave</TH>
              <TH className="text-center">Work Hrs</TH>
              <TH className="text-center hidden md:table-cell">Avg/Day</TH>
              <TH className="text-center text-blue-600 hidden md:table-cell">OT</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <TD className="text-gray-400">{i + 1}</TD>
                <TD><div className="font-medium text-gray-900 dark:text-white">{row.name}</div><div className="text-xs text-gray-400">{row.employeeCode}</div></TD>
                <TD className="text-gray-500 hidden sm:table-cell">{row.department}</TD>
                <TD className="text-center"><Pill color="green">{row.presentDays}</Pill></TD>
                <TD className="text-center"><Pill color="red">{row.absentDays}</Pill></TD>
                <TD className="text-center"><Pill color="yellow">{row.lateDays}</Pill></TD>
                <TD className="text-center hidden lg:table-cell"><span className="text-orange-600 dark:text-orange-400 text-xs font-semibold">{row.halfDays}</span></TD>
                <TD className="text-center hidden lg:table-cell"><span className="text-purple-600 dark:text-purple-400 text-xs font-semibold">{row.onLeaveDays}</span></TD>
                <TD className="text-center font-medium">{row.totalWorkHours}</TD>
                <TD className="text-center text-gray-500 hidden md:table-cell">{row.avgDailyHours}</TD>
                <TD className="text-center text-blue-600 dark:text-blue-400 hidden md:table-cell">{row.totalOTHours}</TD>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
              <TD colSpan={2}>Total ({data.length})</TD><TD className="hidden sm:table-cell" />
              <TD className="text-center text-green-600">{totals.presentDays}</TD>
              <TD className="text-center text-red-600">{totals.absentDays}</TD>
              <TD className="text-center text-yellow-600">{totals.lateDays}</TD>
              <TD className="text-center text-orange-600 hidden lg:table-cell">{totals.halfDays}</TD>
              <TD className="text-center text-purple-600 hidden lg:table-cell">{totals.onLeaveDays}</TD>
              <TD className="text-center">{totals.totalWorkHours.toFixed(1)}</TD>
              <TD className="text-center hidden md:table-cell">-</TD>
              <TD className="text-center text-blue-600 hidden md:table-cell">{totals.totalOTHours.toFixed(1)}</TD>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 2: Daily Attendance (Enhanced) ────────────────
function DailyAttendanceTable({ data }: { data: DailyAttendance[] }) {
  if (data.length === 0) return <EmptyState />;
  const [expanded, setExpanded] = useState<string | null>(null);
  const statusCounts = {
    present: data.filter((d) => d.status === "PRESENT" || d.status === "LATE").length,
    absent: data.filter((d) => d.status === "ABSENT").length,
    late: data.filter((d) => d.status === "LATE").length,
    leave: data.filter((d) => d.status === "ON_LEAVE").length,
  };

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Total" value={data.length} />
        <StatCard label="Present" value={statusCounts.present} color="green" />
        <StatCard label="Absent" value={statusCounts.absent} color="red" />
        <StatCard label="Late" value={statusCounts.late} color="yellow" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH className="text-center">Status</TH>
              <TH className="text-center">In</TH><TH className="text-center">Out</TH>
              <TH className="text-center hidden md:table-cell">Hrs</TH>
              <TH className="text-center hidden lg:table-cell">Reg</TH>
              <TH className="text-center hidden lg:table-cell">Leave</TH>
              <TH className="text-center">Info</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <>
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <TD className="text-gray-400">{i + 1}</TD>
                  <TD><div className="font-medium text-gray-900 dark:text-white">{row.name}</div><div className="text-xs text-gray-400">{row.employeeCode}</div></TD>
                  <TD className="text-gray-500 hidden sm:table-cell">{row.department}</TD>
                  <TD className="text-center"><Badge className={cn("text-[10px]", STATUS_COLORS[row.status] || "")}>{row.status.replace("_", " ")}</Badge></TD>
                  <TD className="text-center text-gray-700 dark:text-gray-300">{row.firstCheckIn}</TD>
                  <TD className="text-center text-gray-700 dark:text-gray-300">{row.lastCheckOut}</TD>
                  <TD className="text-center hidden md:table-cell font-medium">{row.workHours}</TD>
                  <TD className="text-center hidden lg:table-cell">
                    {row.regApplied ? <Pill color={row.regStatus === "APPROVED" ? "green" : row.regStatus === "PENDING" ? "yellow" : "red"}>{row.regStatus}</Pill> : <span className="text-gray-300 dark:text-gray-600">-</span>}
                  </TD>
                  <TD className="text-center hidden lg:table-cell">
                    {row.leaveApplied ? <span className="text-xs text-purple-600 dark:text-purple-400">{row.leaveType}</span> : <span className="text-gray-300 dark:text-gray-600">-</span>}
                  </TD>
                  <TD className="text-center">
                    <button onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="text-blue-600 dark:text-blue-400 text-xs hover:underline">
                      {expanded === row.id ? "Hide" : "View"}
                    </button>
                  </TD>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-detail`}>
                    <td colSpan={10} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                        <InfoBlock label="Check-In Location" value={row.checkInLocation} />
                        <InfoBlock label="Check-Out Location" value={row.checkOutLocation} />
                        <InfoBlock label="Check-In Note" value={row.checkInNote} />
                        <InfoBlock label="Check-Out Note" value={row.checkOutNote} />
                        <InfoBlock label="Sessions" value={String(row.sessions)} />
                        <InfoBlock label="Break Hours" value={String(row.breakHours)} />
                        {row.regApplied && (
                          <>
                            <InfoBlock label="Reg. Type" value={row.regType} />
                            <InfoBlock label="Reg. Status" value={row.regStatus} />
                            <InfoBlock label="Reg. Reason" value={row.regReason} />
                          </>
                        )}
                        {row.leaveApplied && (
                          <>
                            <InfoBlock label="Leave Type" value={row.leaveType} />
                            <InfoBlock label="Leave Status" value={row.leaveStatus} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 3: Detailed Attendance Log ────────────────────
function DetailedLogView({ data }: { data: DetailedLogEntry[] }) {
  if (data.length === 0) return <EmptyState />;
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Group by employee
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; employeeCode: string; designation: string; department: string; shift: string; entries: DetailedLogEntry[] }>();
    for (const entry of data) {
      if (!map.has(entry.employeeId)) {
        map.set(entry.employeeId, { name: entry.name, employeeCode: entry.employeeCode, designation: entry.designation, department: entry.department, shift: entry.shift, entries: [] });
      }
      map.get(entry.employeeId)!.entries.push(entry);
    }
    return Array.from(map.entries());
  }, [data]);

  const filtered = searchTerm
    ? grouped.filter(([, g]) => g.name.toLowerCase().includes(searchTerm.toLowerCase()) || g.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()))
    : grouped;

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <Input placeholder="Search employee name or code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Employees" value={filtered.length} />
        <StatCard label="Total Records" value={data.length} />
        <StatCard label="Reg. Applied" value={data.filter((d) => d.regApplied).length} color="yellow" />
        <StatCard label="Leaves" value={data.filter((d) => d.leaveApplied).length} color="purple" />
      </div>
      {filtered.map(([empId, group]) => (
        <Card key={empId}>
          <button
            onClick={() => setExpanded(expanded === empId ? null : empId)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30"
          >
            <div className="text-left">
              <div className="font-medium text-gray-900 dark:text-white">{group.name}</div>
              <div className="text-xs text-gray-400">{group.employeeCode} · {group.designation} · {group.department} · {group.shift}</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Pill color="green">{group.entries.filter((e) => e.status === "PRESENT" || e.status === "LATE").length}P</Pill>
              <Pill color="red">{group.entries.filter((e) => e.status === "ABSENT").length}A</Pill>
              <Pill color="yellow">{group.entries.filter((e) => e.status === "LATE").length}L</Pill>
              <span className="text-blue-600 dark:text-blue-400">{expanded === empId ? "▲" : "▼"}</span>
            </div>
          </button>
          {expanded === empId && (
            <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <TH className="text-[11px]">Date</TH><TH className="text-[11px]">Day</TH>
                    <TH className="text-[11px] text-center">Status</TH>
                    <TH className="text-[11px] text-center">In</TH><TH className="text-[11px] text-center">Out</TH>
                    <TH className="text-[11px] text-center">Hrs</TH><TH className="text-[11px] text-center">OT</TH>
                    <TH className="text-[11px] hidden md:table-cell">Location</TH>
                    <TH className="text-[11px] hidden lg:table-cell">Notes</TH>
                    <TH className="text-[11px] text-center">Reg</TH>
                    <TH className="text-[11px] text-center">Leave</TH>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {group.entries.map((e) => (
                    <tr key={`${empId}-${e.date}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <TD className="whitespace-nowrap">{e.date}</TD>
                      <TD>{e.dayName}</TD>
                      <TD className="text-center"><Badge className={cn("text-[9px]", STATUS_COLORS[e.status] || "")}>{e.status.replace("_", " ")}</Badge></TD>
                      <TD className="text-center">{e.checkIn}</TD>
                      <TD className="text-center">{e.checkOut}{e.isAutoOut && <span className="text-red-400 ml-0.5" title="Auto check-out">⚡</span>}</TD>
                      <TD className="text-center font-medium">{e.workHours || "-"}</TD>
                      <TD className="text-center text-blue-600">{e.otHours || "-"}</TD>
                      <TD className="hidden md:table-cell max-w-[140px] truncate" title={e.checkInLocation !== "-" ? e.checkInLocation : ""}>
                        {e.checkInLocation !== "-" ? `📍 ${e.checkInLocation}` : "-"}
                      </TD>
                      <TD className="hidden lg:table-cell max-w-[120px] truncate" title={e.checkInNote !== "-" ? e.checkInNote : ""}>
                        {e.checkInNote !== "-" ? `💬 ${e.checkInNote}` : "-"}
                      </TD>
                      <TD className="text-center">
                        {e.regApplied ? (
                          <span title={`${e.regType}: ${e.regReason}`}>
                            <Pill color={e.regStatus === "APPROVED" ? "green" : e.regStatus === "PENDING" ? "yellow" : "red"}>{e.regStatus.slice(0, 3)}</Pill>
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </TD>
                      <TD className="text-center">
                        {e.leaveApplied ? (
                          <span className="text-purple-600 dark:text-purple-400" title={`${e.leaveType} (${e.leaveStatus})`}>{e.leaveType.slice(0, 2)}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Report 4: Weekly Report ──────────────────────────────
function WeeklyReportTable({ data }: { data: WeeklyEntry[] }) {
  if (data.length === 0) return <EmptyState />;

  // Group by employee
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; employeeCode: string; department: string; weeks: WeeklyEntry[] }>();
    for (const entry of data) {
      if (!map.has(entry.employeeId)) {
        map.set(entry.employeeId, { name: entry.name, employeeCode: entry.employeeCode, department: entry.department, weeks: [] });
      }
      map.get(entry.employeeId)!.weeks.push(entry);
    }
    return Array.from(map.entries());
  }, [data]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const totalWorkHrs = data.reduce((a, d) => a + d.totalWorkHours, 0);

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Employees" value={grouped.length} />
        <StatCard label="Total Work Hours" value={totalWorkHrs.toFixed(1)} color="blue" />
        <StatCard label="Total OT Hours" value={data.reduce((a, d) => a + d.totalOTHours, 0).toFixed(1)} color="green" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH className="text-center">Weeks</TH>
              <TH className="text-center text-green-600">Total Present</TH>
              <TH className="text-center">Total Hrs</TH>
              <TH className="text-center">Detail</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {grouped.map(([empId, g], i) => {
              const totalPresent = g.weeks.reduce((a, w) => a + w.presentDays, 0);
              const totalHrs = g.weeks.reduce((a, w) => a + w.totalWorkHours, 0);
              return (
                <>
                  <tr key={empId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer" onClick={() => setExpanded(expanded === empId ? null : empId)}>
                    <TD className="text-gray-400">{i + 1}</TD>
                    <TD><div className="font-medium text-gray-900 dark:text-white">{g.name}</div><div className="text-xs text-gray-400">{g.employeeCode}</div></TD>
                    <TD className="text-gray-500 hidden sm:table-cell">{g.department}</TD>
                    <TD className="text-center">{g.weeks.length}</TD>
                    <TD className="text-center"><Pill color="green">{totalPresent}</Pill></TD>
                    <TD className="text-center font-medium">{totalHrs.toFixed(1)}</TD>
                    <TD className="text-center"><button className="text-blue-600 text-xs hover:underline">{expanded === empId ? "Hide" : "View"}</button></TD>
                  </tr>
                  {expanded === empId && (
                    <tr key={`${empId}-w`}>
                      <td colSpan={7} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-white dark:bg-gray-900">
                                <TH className="text-[11px]">Week</TH>
                                <TH className="text-[11px] text-center text-green-600">Present</TH>
                                <TH className="text-[11px] text-center text-red-600">Absent</TH>
                                <TH className="text-[11px] text-center text-yellow-600">Late</TH>
                                <TH className="text-[11px] text-center text-purple-600">Leave</TH>
                                <TH className="text-[11px] text-center">Hours</TH>
                                <TH className="text-[11px] text-center text-blue-600">OT</TH>
                                <TH className="text-[11px] text-center">Avg/Day</TH>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {g.weeks.map((w) => (
                                <tr key={w.weekStart}>
                                  <TD className="whitespace-nowrap font-medium">{w.weekLabel}</TD>
                                  <TD className="text-center text-green-600">{w.presentDays}</TD>
                                  <TD className="text-center text-red-600">{w.absentDays}</TD>
                                  <TD className="text-center text-yellow-600">{w.lateDays}</TD>
                                  <TD className="text-center text-purple-600">{w.leaveDays}</TD>
                                  <TD className="text-center font-medium">{w.totalWorkHours}</TD>
                                  <TD className="text-center text-blue-600">{w.totalOTHours}</TD>
                                  <TD className="text-center text-gray-500">{w.avgDailyHours}</TD>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 5: Monthly / Payroll ──────────────────────────
function MonthlyPayrollTable({ data }: { data: PayrollEntry[] }) {
  if (data.length === 0) return <EmptyState />;
  const [expanded, setExpanded] = useState<string | null>(null);

  const totals = {
    present: data.reduce((a, d) => a + d.presentDays, 0),
    absent: data.reduce((a, d) => a + d.absentDays, 0),
    effective: data.reduce((a, d) => a + d.effectiveDays, 0),
    workHours: data.reduce((a, d) => a + d.totalWorkHours, 0),
    otHours: data.reduce((a, d) => a + d.totalOTHours, 0),
  };

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Employees" value={data.length} />
        <StatCard label="Total Present" value={totals.present} color="green" />
        <StatCard label="Total Absent" value={totals.absent} color="red" />
        <StatCard label="Effective Days" value={totals.effective.toFixed(1)} color="blue" />
        <StatCard label="Total OT Hrs" value={totals.otHours.toFixed(1)} color="green" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH className="text-center text-green-600">Present</TH>
              <TH className="text-center text-red-600">Absent</TH>
              <TH className="text-center text-yellow-600">Late</TH>
              <TH className="text-center text-purple-600 hidden md:table-cell">Leave</TH>
              <TH className="text-center text-blue-600">Effective</TH>
              <TH className="text-center hidden md:table-cell">Hrs</TH>
              <TH className="text-center hidden lg:table-cell">OT</TH>
              <TH className="text-center">Detail</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <>
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                  <TD className="text-gray-400">{i + 1}</TD>
                  <TD>
                    <div className="font-medium text-gray-900 dark:text-white">{row.name}</div>
                    <div className="text-xs text-gray-400">{row.employeeCode} · {row.designation}</div>
                  </TD>
                  <TD className="text-gray-500 hidden sm:table-cell">{row.department}</TD>
                  <TD className="text-center"><Pill color="green">{row.presentDays}</Pill></TD>
                  <TD className="text-center"><Pill color="red">{row.absentDays}</Pill></TD>
                  <TD className="text-center"><Pill color="yellow">{row.lateDays}</Pill></TD>
                  <TD className="text-center text-purple-600 hidden md:table-cell">{row.leaveDays}</TD>
                  <TD className="text-center font-bold text-blue-600">{row.effectiveDays}</TD>
                  <TD className="text-center hidden md:table-cell">{row.totalWorkHours}</TD>
                  <TD className="text-center text-blue-600 hidden lg:table-cell">{row.totalOTHours}</TD>
                  <TD className="text-center"><button className="text-blue-600 text-xs hover:underline">{expanded === row.id ? "Hide" : "View"}</button></TD>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-d`}>
                    <td colSpan={11} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <InfoBlock label="Shift" value={row.shift} />
                        <InfoBlock label="Working Days" value={String(row.totalWorkingDays)} />
                        <InfoBlock label="Half Days" value={String(row.halfDays)} />
                        <InfoBlock label="Short Hour Days" value={String(row.shortHoursDays)} />
                        <InfoBlock label="Avg Hrs/Day" value={String(row.avgDailyHours)} />
                        <InfoBlock label="Reg. Approved" value={String(row.regsApproved)} />
                        <InfoBlock label="Reg. Pending" value={String(row.regsPending)} />
                      </div>
                      {row.leaveBreakdown.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Leave Breakdown</p>
                          <div className="flex flex-wrap gap-2">
                            {row.leaveBreakdown.map((l) => (
                              <span key={l.type} className="px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs">
                                {l.type}: {l.days}d
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {row.leaveBalance.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Leave Balance</p>
                          <div className="flex flex-wrap gap-2">
                            {row.leaveBalance.map((b) => (
                              <span key={b.type} className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                                {b.type}: <span className="text-blue-600">A:{b.allocated}</span> <span className="text-red-600">U:{b.used}</span> <span className={b.balance > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>B:{b.balance}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 6: Late Arrivals ──────────────────────────────
function LateArrivalsTable({ data }: { data: LateArrival[] }) {
  if (data.length === 0) return <EmptyState message="No late arrivals found." />;
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Employees Late" value={data.length} color="yellow" />
        <StatCard label="Total Late Days" value={data.reduce((a, d) => a + d.lateDays, 0)} color="red" />
        <StatCard label="Most Late" value={data[0]?.name?.split(" ")[0] || "-"} sub={`${data[0]?.lateDays || 0} days`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH className="hidden md:table-cell">Shift</TH>
              <TH className="text-center text-yellow-600">Late Days</TH><TH className="text-center">Details</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <>
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                  <TD className="text-gray-400">{i + 1}</TD>
                  <TD><div className="font-medium text-gray-900 dark:text-white">{row.name}</div><div className="text-xs text-gray-400">{row.employeeCode}</div></TD>
                  <TD className="text-gray-500 hidden sm:table-cell">{row.department}</TD>
                  <TD className="text-gray-500 text-xs hidden md:table-cell">{row.shift}</TD>
                  <TD className="text-center"><Pill color="yellow">{row.lateDays}</Pill></TD>
                  <TD className="text-center"><button className="text-blue-600 text-xs hover:underline">{expanded === row.id ? "Hide" : "View"}</button></TD>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-d`}>
                    <td colSpan={6} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20">
                      <div className="flex flex-wrap gap-2">
                        {row.dates.map((d) => (
                          <span key={d.date} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                            <span className="font-medium">{d.date}</span><span className="text-gray-400">@</span><span className="text-yellow-600">{d.checkIn}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 7: Overtime ───────────────────────────────────
function OvertimeTable({ data }: { data: OvertimeData[] }) {
  if (data.length === 0) return <EmptyState message="No overtime records found." />;
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalOT = data.reduce((a, d) => a + d.totalOTHours, 0);

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Employees with OT" value={data.length} color="blue" />
        <StatCard label="Total OT Hours" value={totalOT.toFixed(1)} color="blue" />
        <StatCard label="Avg OT / Employee" value={(totalOT / data.length).toFixed(1)} sub="hours" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH className="text-center text-blue-600">OT Days</TH><TH className="text-center text-blue-600">Total OT</TH>
              <TH className="text-center hidden md:table-cell">Avg/Day</TH><TH className="text-center">Details</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <>
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                  <TD className="text-gray-400">{i + 1}</TD>
                  <TD><div className="font-medium text-gray-900 dark:text-white">{row.name}</div><div className="text-xs text-gray-400">{row.employeeCode}</div></TD>
                  <TD className="text-gray-500 hidden sm:table-cell">{row.department}</TD>
                  <TD className="text-center"><Pill color="blue">{row.otDays}</Pill></TD>
                  <TD className="text-center font-semibold text-blue-600">{row.totalOTHours}h</TD>
                  <TD className="text-center text-gray-500 hidden md:table-cell">{row.avgOTPerDay}h</TD>
                  <TD className="text-center"><button className="text-blue-600 text-xs hover:underline">{expanded === row.id ? "Hide" : "View"}</button></TD>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-d`}>
                    <td colSpan={7} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20">
                      <div className="flex flex-wrap gap-2">
                        {row.dates.map((d) => (
                          <span key={d.date} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                            <span className="font-medium">{d.date}</span><span className="text-blue-600">{d.otHours}h</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 8: Leave Summary ──────────────────────────────
function LeaveSummaryTable({ data }: { data: LeaveData[] }) {
  if (data.length === 0) return <EmptyState message="No leave data found." />;
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Employees" value={data.length} />
        <StatCard label="Total Allocated" value={data.reduce((a, d) => a + d.totalAllocated, 0)} color="blue" />
        <StatCard label="Total Used" value={data.reduce((a, d) => a + d.totalUsed, 0)} color="red" />
        <StatCard label="Total Pending" value={data.reduce((a, d) => a + d.totalPending, 0)} color="yellow" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH className="text-center text-blue-600">Allocated</TH><TH className="text-center text-red-600">Used</TH>
              <TH className="text-center text-yellow-600 hidden md:table-cell">Pending</TH>
              <TH className="text-center text-green-600">Balance</TH><TH className="text-center">Details</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <>
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                  <TD className="text-gray-400">{i + 1}</TD>
                  <TD><div className="font-medium text-gray-900 dark:text-white">{row.name}</div><div className="text-xs text-gray-400">{row.employeeCode}</div></TD>
                  <TD className="text-gray-500 hidden sm:table-cell">{row.department}</TD>
                  <TD className="text-center text-blue-600 font-medium">{row.totalAllocated}</TD>
                  <TD className="text-center text-red-600 font-medium">{row.totalUsed}</TD>
                  <TD className="text-center text-yellow-600 font-medium hidden md:table-cell">{row.totalPending}</TD>
                  <TD className="text-center"><Pill color={row.totalBalance > 0 ? "green" : "red"}>{row.totalBalance.toFixed(1)}</Pill></TD>
                  <TD className="text-center"><button className="text-blue-600 text-xs hover:underline">{expanded === row.id ? "Hide" : "View"}</button></TD>
                </tr>
                {expanded === row.id && row.balances.length > 0 && (
                  <tr key={`${row.id}-d`}>
                    <td colSpan={8} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {row.balances.map((b) => (
                          <div key={b.code} className="flex items-center justify-between px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{b.leaveType}</span>
                            <div className="flex gap-3">
                              <span className="text-blue-600">A:{b.allocated}</span>
                              <span className="text-red-600">U:{b.used}</span>
                              <span className="text-yellow-600">P:{b.pending}</span>
                              <span className={b.balance > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>B:{b.balance}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 9: Regularization ─────────────────────────────
function RegularizationTable({ data }: { data: { stats: { total: number; approved: number; pending: number; rejected: number }; data: RegEntry[] } }) {
  if (data.data.length === 0) return <EmptyState message="No regularization requests found." />;
  const { stats, data: rows } = data;

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Total Requests" value={stats.total} />
        <StatCard label="Approved" value={stats.approved} color="green" />
        <StatCard label="Pending" value={stats.pending} color="yellow" />
        <StatCard label="Rejected" value={stats.rejected} color="red" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH>Date</TH><TH>Type</TH><TH className="text-center">Status</TH>
              <TH className="hidden lg:table-cell">Reason</TH><TH className="hidden md:table-cell">Reviewer</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row, i) => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <TD className="text-gray-400">{i + 1}</TD>
                <TD><div className="font-medium text-gray-900 dark:text-white">{row.employeeName}</div><div className="text-xs text-gray-400">{row.employeeCode}</div></TD>
                <TD className="text-gray-500 hidden sm:table-cell">{row.department}</TD>
                <TD className="whitespace-nowrap">{row.date}</TD>
                <TD className="text-xs">{row.type}</TD>
                <TD className="text-center">
                  <Pill color={row.status === "APPROVED" ? "green" : row.status === "PENDING" ? "yellow" : "red"}>{row.status}</Pill>
                </TD>
                <TD className="hidden lg:table-cell max-w-[200px] truncate text-xs text-gray-500" title={row.reason}>{row.reason}</TD>
                <TD className="hidden md:table-cell text-xs text-gray-500">
                  {row.reviewer !== "-" && <div>{row.reviewer}</div>}
                  {row.reviewNote !== "-" && <div className="text-gray-400 truncate max-w-[150px]" title={row.reviewNote}>{row.reviewNote}</div>}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 10: Discrepancy ───────────────────────────────
function DiscrepancyTable({ data }: { data: { stats: { total: number; missingCheckout: number; absentNoLeave: number; shortHours: number; lateNoReg: number }; data: DiscrepancyEntry[] } }) {
  if (data.data.length === 0) return <EmptyState message="No discrepancies found — all records look good!" />;
  const { stats, data: rows } = data;
  const TYPE_COLORS: Record<string, string> = {
    "Missing Check-Out": "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    "Absent - No Leave/Reg": "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    "Short Hours": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    "Late - No Reg": "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Total Issues" value={stats.total} color="red" />
        <StatCard label="Missing Check-Out" value={stats.missingCheckout} color="yellow" />
        <StatCard label="Absent (No Leave)" value={stats.absentNoLeave} color="red" />
        <StatCard label="Short Hours" value={stats.shortHours} color="yellow" />
        <StatCard label="Late (No Reg)" value={stats.lateNoReg} color="blue" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <TH>#</TH><TH>Employee</TH><TH className="hidden sm:table-cell">Dept</TH>
              <TH>Date</TH><TH>Issue</TH><TH className="hidden md:table-cell">Detail</TH>
              <TH className="text-center">Reg</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row, i) => (
              <tr key={`${row.employeeId}-${row.date}-${row.type}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <TD className="text-gray-400">{i + 1}</TD>
                <TD><div className="font-medium text-gray-900 dark:text-white">{row.name}</div><div className="text-xs text-gray-400">{row.employeeCode}</div></TD>
                <TD className="text-gray-500 hidden sm:table-cell">{row.department}</TD>
                <TD className="whitespace-nowrap">{row.date}</TD>
                <TD><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", TYPE_COLORS[row.type] || "")}>{row.type}</span></TD>
                <TD className="hidden md:table-cell text-xs text-gray-500 max-w-[250px] truncate" title={row.detail}>{row.detail}</TD>
                <TD className="text-center">
                  {row.hasReg ? <Pill color={row.regStatus === "APPROVED" ? "green" : row.regStatus === "PENDING" ? "yellow" : "red"}>{row.regStatus}</Pill> : <span className="text-gray-300">-</span>}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 11: Daily Email Report ────────────────────────
function DailyEmailReportView({ data }: { data: DailyEmailReport }) {
  const STATUS_BG: Record<string, string> = {
    PRESENT: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    LATE: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    HALF_DAY: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    ABSENT: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    ON_LEAVE: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{data.displayDate}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{data.entities.length} entities</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          <StatCard label="Present" value={data.stats.present} color="green" />
          <StatCard label="Absent" value={data.stats.absent} color="red" />
          <StatCard label="Late" value={data.stats.late} color="yellow" />
          <StatCard label="Total" value={data.stats.total} sub={`${data.stats.total > 0 ? Math.round((data.stats.present / data.stats.total) * 100) : 0}% att.`} />
        </div>
      </Card>
      {data.entities.map((ent) => (
        <Card key={ent.entityId}>
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 rounded-t-xl">
            <h3 className="text-white font-bold flex items-center gap-2"><span>🏢</span> {ent.entityName}</h3>
            <div className="flex gap-4 mt-1 text-blue-100 text-xs">
              <span>{ent.present} present</span><span>{ent.absent} absent</span><span>{ent.late} late</span><span>{ent.total} total</span>
            </div>
          </div>
          {ent.locations.map((loc) => (
            <div key={loc.locationId}>
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20 flex items-center gap-2">
                <span className="text-sm">📍</span>
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{loc.locationName}</span>
                <span className="text-xs text-gray-500 ml-2">{loc.present} present · {loc.absent} absent · {loc.total} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <TH className="text-xs">Employee</TH><TH className="text-xs hidden sm:table-cell">Dept</TH>
                      <TH className="text-xs text-center">Status</TH><TH className="text-xs text-center">In</TH>
                      <TH className="text-xs text-center">Out</TH><TH className="text-xs text-center">Hrs</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {loc.employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <TD><div className="font-medium text-gray-900 dark:text-white text-sm">{emp.name}</div>{emp.employeeCode && <div className="text-[11px] text-gray-400">{emp.employeeCode}</div>}</TD>
                        <TD className="text-gray-500 text-xs hidden sm:table-cell">{emp.department}</TD>
                        <TD className="text-center"><span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold", STATUS_BG[emp.status] || "bg-gray-100 dark:bg-gray-800 text-gray-500")}>{emp.status.replace("_", " ")}</span></TD>
                        <TD className="text-center text-xs">{emp.firstCheckIn || "—"}</TD>
                        <TD className="text-center text-xs">{emp.lastCheckOut || "—"}</TD>
                        <TD className="text-center text-xs font-medium">{emp.workHours}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Card>
      ))}
      {data.entities.length === 0 && <EmptyState message="No attendance data for this date." />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════
function TH({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("text-left px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-sm", className)} {...props}>{children}</th>;
}

function TD({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-3", className)} {...props}>{children}</td>;
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    green: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    yellow: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };
  return <span className={cn("inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold text-center", colors[color] || "")}>{children}</span>;
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  const colors: Record<string, string> = {
    green: "text-green-600 dark:text-green-400", red: "text-red-600 dark:text-red-400",
    yellow: "text-yellow-600 dark:text-yellow-400", blue: "text-blue-600 dark:text-blue-400",
    purple: "text-purple-600 dark:text-purple-400", default: "text-gray-900 dark:text-white",
  };
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn("text-xl font-bold", colors[color || "default"])}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  if (!value || value === "-") return null;
  return (
    <div className="px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <Card className="p-12 text-center">
      <div className="text-4xl mb-2">📭</div>
      <p className="text-gray-400 dark:text-gray-500">{message || "No records found for the selected filters."}</p>
    </Card>
  );
}
