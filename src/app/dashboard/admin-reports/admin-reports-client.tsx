"use client";

import { useState, useCallback } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Button, Card, Badge, Input, Select } from "@/components/ui";
import { STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────
interface Department {
  id: string;
  name: string;
}

interface EntityOption {
  id: string;
  name: string;
}

interface LocationOption {
  id: string;
  name: string;
  entityId: string | null;
}

interface AttendanceSummary {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  onLeaveDays: number;
  totalWorkHours: number;
  avgDailyHours: number;
  totalOTHours: number;
}

interface DailyAttendance {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  status: string;
  firstCheckIn: string;
  lastCheckOut: string;
  checkInLocation: string;
  checkOutLocation: string;
  workHours: number;
  breakHours: number;
  sessions: number;
  isLate: boolean;
}

interface LateArrival {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  lateDays: number;
  dates: Array<{ date: string; checkIn: string }>;
}

interface OvertimeData {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  otDays: number;
  totalOTHours: number;
  avgOTPerDay: number;
  dates: Array<{ date: string; otHours: number }>;
}

interface LeaveData {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  balances: Array<{
    leaveType: string;
    code: string;
    allocated: number;
    used: number;
    pending: number;
    balance: number;
  }>;
  totalAllocated: number;
  totalUsed: number;
  totalPending: number;
  totalBalance: number;
}

type ReportTab =
  | "attendance-summary"
  | "daily-attendance"
  | "late-arrivals"
  | "overtime"
  | "leave-summary";

const TABS: { key: ReportTab; label: string; icon: string }[] = [
  { key: "attendance-summary", label: "Attendance Summary", icon: "📊" },
  { key: "daily-attendance", label: "Daily View", icon: "📅" },
  { key: "late-arrivals", label: "Late Arrivals", icon: "⏰" },
  { key: "overtime", label: "Overtime", icon: "🕐" },
  { key: "leave-summary", label: "Leave Summary", icon: "🏖️" },
];

// ─── Main Component ───────────────────────────────────────
export function AdminReportsClient({
  departments,
  entities,
  locations,
}: {
  departments: Department[];
  entities: EntityOption[];
  locations: LocationOption[];
}) {
  const [activeTab, setActiveTab] = useState<ReportTab>("attendance-summary");
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [department, setDepartment] = useState("");
  const [entity, setEntity] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  // Filter locations by selected entity
  const filteredLocations = entity
    ? locations.filter((l) => l.entityId === entity)
    : locations;
  const [exporting, setExporting] = useState(false);

  // Report data states
  const [attendanceData, setAttendanceData] = useState<AttendanceSummary[]>([]);
  const [dailyData, setDailyData] = useState<DailyAttendance[]>([]);
  const [lateData, setLateData] = useState<LateArrival[]>([]);
  const [overtimeData, setOvertimeData] = useState<OvertimeData[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveData[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        type: activeTab,
        start: startDate,
        end: endDate,
      });
      if (department) params.set("department", department);
      if (entity) params.set("entity", entity);
      if (location) params.set("location", location);

      const res = await fetch(`/api/reports/admin?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to fetch");

      switch (activeTab) {
        case "attendance-summary":
          setAttendanceData(json.data);
          break;
        case "daily-attendance":
          setDailyData(json.data);
          break;
        case "late-arrivals":
          setLateData(json.data);
          break;
        case "overtime":
          setOvertimeData(json.data);
          break;
        case "leave-summary":
          setLeaveData(json.data);
          break;
      }
    } catch {
      /* toast or alert */
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, department, entity, location]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        type: activeTab,
        start: startDate,
        end: endDate,
        export: "excel",
      });
      if (department) params.set("department", department);
      if (entity) params.set("entity", entity);
      if (location) params.set("location", location);

      const res = await fetch(`/api/reports/admin?${params}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeTab}-${startDate}-to-${endDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* toast */
    } finally {
      setExporting(false);
    }
  };

  // Quick date presets
  const setPreset = (days: number) => {
    const end = new Date();
    const start = subDays(end, days - 1);
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Admin Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generate and export employee reports
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setHasSearched(false);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Department
              </label>
              <Select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={[
                  { value: "", label: "All Departments" },
                  ...departments.map((d) => ({
                    value: d.id,
                    label: d.name,
                  })),
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Entity
              </label>
              <Select
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  setLocation("");
                }}
                options={[
                  { value: "", label: "All Entities" },
                  ...entities.map((en) => ({
                    value: en.id,
                    label: en.name,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Location
              </label>
              <Select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                options={[
                  { value: "", label: "All Locations" },
                  ...filteredLocations.map((l) => ({
                    value: l.id,
                    label: l.name,
                  })),
                ]}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchReport} loading={loading} className="flex-1">
                Generate
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                loading={exporting}
                disabled={!hasSearched}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="hidden sm:inline ml-1">Excel</span>
              </Button>
            </div>
          </div>
          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-400 self-center">Quick:</span>
            {[
              { label: "Today", days: 1 },
              { label: "7 Days", days: 7 },
              { label: "30 Days", days: 30 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setPreset(p.days)}
                className="px-2 py-0.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={setThisMonth}
              className="px-2 py-0.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              This Month
            </button>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      {loading ? (
        <Card className="p-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </Card>
      ) : !hasSearched ? (
        <Card className="p-12 text-center">
          <p className="text-gray-400 dark:text-gray-500">
            Select filters and click &quot;Generate&quot; to view the report.
          </p>
        </Card>
      ) : (
        <>
          {activeTab === "attendance-summary" && (
            <AttendanceSummaryTable data={attendanceData} />
          )}
          {activeTab === "daily-attendance" && (
            <DailyAttendanceTable data={dailyData} />
          )}
          {activeTab === "late-arrivals" && (
            <LateArrivalsTable data={lateData} />
          )}
          {activeTab === "overtime" && <OvertimeTable data={overtimeData} />}
          {activeTab === "leave-summary" && (
            <LeaveSummaryTable data={leaveData} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Report 1: Attendance Summary Table ───────────────────
function AttendanceSummaryTable({ data }: { data: AttendanceSummary[] }) {
  if (data.length === 0) return <EmptyState />;

  // Totals row
  const totals = data.reduce(
    (acc, d) => ({
      totalDays: acc.totalDays + d.totalDays,
      presentDays: acc.presentDays + d.presentDays,
      absentDays: acc.absentDays + d.absentDays,
      lateDays: acc.lateDays + d.lateDays,
      halfDays: acc.halfDays + d.halfDays,
      onLeaveDays: acc.onLeaveDays + d.onLeaveDays,
      totalWorkHours: acc.totalWorkHours + d.totalWorkHours,
      totalOTHours: acc.totalOTHours + d.totalOTHours,
    }),
    {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      halfDays: 0,
      onLeaveDays: 0,
      totalWorkHours: 0,
      totalOTHours: 0,
    }
  );

  return (
    <Card>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Total Employees" value={data.length} />
        <StatCard
          label="Avg Present %"
          value={
            data.length > 0
              ? `${Math.round(
                  (totals.presentDays / Math.max(totals.totalDays, 1)) * 100
                )}%`
              : "0%"
          }
          color="green"
        />
        <StatCard
          label="Total Late Days"
          value={totals.lateDays}
          color="yellow"
        />
        <StatCard
          label="Total OT Hours"
          value={totals.totalOTHours.toFixed(1)}
          color="blue"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                #
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Employee
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                Dept
              </th>
              <th className="text-center px-3 py-3 font-semibold text-green-600">
                Present
              </th>
              <th className="text-center px-3 py-3 font-semibold text-red-600">
                Absent
              </th>
              <th className="text-center px-3 py-3 font-semibold text-yellow-600">
                Late
              </th>
              <th className="text-center px-3 py-3 font-semibold text-orange-600 hidden lg:table-cell">
                Half
              </th>
              <th className="text-center px-3 py-3 font-semibold text-purple-600 hidden lg:table-cell">
                Leave
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Work Hrs
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">
                Avg/Day
              </th>
              <th className="text-center px-3 py-3 font-semibold text-blue-600 hidden md:table-cell">
                OT
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/30"
              >
                <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {row.name}
                  </div>
                  <div className="text-xs text-gray-400">{row.employeeCode}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                  {row.department}
                </td>
                <td className="text-center px-3 py-3">
                  <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                    {row.presentDays}
                  </span>
                </td>
                <td className="text-center px-3 py-3">
                  <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold">
                    {row.absentDays}
                  </span>
                </td>
                <td className="text-center px-3 py-3">
                  <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-semibold">
                    {row.lateDays}
                  </span>
                </td>
                <td className="text-center px-3 py-3 hidden lg:table-cell">
                  <span className="text-orange-600 dark:text-orange-400 text-xs font-semibold">
                    {row.halfDays}
                  </span>
                </td>
                <td className="text-center px-3 py-3 hidden lg:table-cell">
                  <span className="text-purple-600 dark:text-purple-400 text-xs font-semibold">
                    {row.onLeaveDays}
                  </span>
                </td>
                <td className="text-center px-3 py-3 font-medium text-gray-900 dark:text-white">
                  {row.totalWorkHours}
                </td>
                <td className="text-center px-3 py-3 text-gray-500 hidden md:table-cell">
                  {row.avgDailyHours}
                </td>
                <td className="text-center px-3 py-3 text-blue-600 dark:text-blue-400 hidden md:table-cell">
                  {row.totalOTHours}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold text-gray-900 dark:text-white">
              <td className="px-4 py-3" colSpan={2}>
                Total ({data.length} employees)
              </td>
              <td className="hidden sm:table-cell" />
              <td className="text-center px-3 py-3 text-green-600">
                {totals.presentDays}
              </td>
              <td className="text-center px-3 py-3 text-red-600">
                {totals.absentDays}
              </td>
              <td className="text-center px-3 py-3 text-yellow-600">
                {totals.lateDays}
              </td>
              <td className="text-center px-3 py-3 text-orange-600 hidden lg:table-cell">
                {totals.halfDays}
              </td>
              <td className="text-center px-3 py-3 text-purple-600 hidden lg:table-cell">
                {totals.onLeaveDays}
              </td>
              <td className="text-center px-3 py-3">
                {totals.totalWorkHours.toFixed(1)}
              </td>
              <td className="text-center px-3 py-3 hidden md:table-cell">-</td>
              <td className="text-center px-3 py-3 text-blue-600 hidden md:table-cell">
                {totals.totalOTHours.toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 2: Daily Attendance Table ─────────────────────
function DailyAttendanceTable({ data }: { data: DailyAttendance[] }) {
  if (data.length === 0) return <EmptyState />;

  const statusCounts = {
    present: data.filter((d) => d.status === "PRESENT" || d.status === "LATE")
      .length,
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
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                #
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Employee
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                Dept
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Status
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Check In
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Check Out
              </th>
              <th className="text-left px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                Location
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">
                Work Hrs
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                Sessions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/30"
              >
                <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {row.name}
                  </div>
                  <div className="text-xs text-gray-400">{row.employeeCode}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                  {row.department}
                </td>
                <td className="text-center px-3 py-3">
                  <Badge
                    className={cn(
                      "text-[10px]",
                      STATUS_COLORS[row.status] || ""
                    )}
                  >
                    {row.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="text-center px-3 py-3 text-gray-700 dark:text-gray-300">
                  {row.firstCheckIn}
                </td>
                <td className="text-center px-3 py-3 text-gray-700 dark:text-gray-300">
                  {row.lastCheckOut}
                </td>
                <td className="text-left px-3 py-3 hidden lg:table-cell">
                  {row.checkInLocation && row.checkInLocation !== "-" ? (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={row.checkInLocation}>
                      📍 {row.checkInLocation}
                    </p>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">-</span>
                  )}
                </td>
                <td className="text-center px-3 py-3 font-medium hidden md:table-cell">
                  {row.workHours}
                </td>
                <td className="text-center px-3 py-3 text-gray-500 hidden lg:table-cell">
                  {row.sessions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Report 3: Late Arrivals Table ────────────────────────
function LateArrivalsTable({ data }: { data: LateArrival[] }) {
  if (data.length === 0) return <EmptyState message="No late arrivals found." />;

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Employees Late" value={data.length} color="yellow" />
        <StatCard
          label="Total Late Days"
          value={data.reduce((a, d) => a + d.lateDays, 0)}
          color="red"
        />
        <StatCard
          label="Most Late"
          value={data[0]?.name?.split(" ")[0] || "-"}
          sub={`${data[0]?.lateDays || 0} days`}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                #
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Employee
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                Dept
              </th>
              <th className="text-center px-3 py-3 font-semibold text-yellow-600">
                Late Days
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <>
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer"
                  onClick={() =>
                    setExpanded(expanded === row.id ? null : row.id)
                  }
                >
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {row.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {row.employeeCode}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {row.department}
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-semibold">
                      {row.lateDays}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <button className="text-blue-600 dark:text-blue-400 text-xs hover:underline">
                      {expanded === row.id ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-details`}>
                    <td
                      colSpan={5}
                      className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20"
                    >
                      <div className="flex flex-wrap gap-2">
                        {row.dates.map((d) => (
                          <span
                            key={d.date}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                          >
                            <span className="font-medium">{d.date}</span>
                            <span className="text-gray-400">@</span>
                            <span className="text-yellow-600">{d.checkIn}</span>
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

// ─── Report 4: Overtime Table ─────────────────────────────
function OvertimeTable({ data }: { data: OvertimeData[] }) {
  if (data.length === 0)
    return <EmptyState message="No overtime records found." />;

  const [expanded, setExpanded] = useState<string | null>(null);

  const totalOT = data.reduce((a, d) => a + d.totalOTHours, 0);

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Employees with OT" value={data.length} color="blue" />
        <StatCard
          label="Total OT Hours"
          value={totalOT.toFixed(1)}
          color="blue"
        />
        <StatCard
          label="Avg OT / Employee"
          value={(totalOT / data.length).toFixed(1)}
          sub="hours"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                #
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Employee
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                Dept
              </th>
              <th className="text-center px-3 py-3 font-semibold text-blue-600">
                OT Days
              </th>
              <th className="text-center px-3 py-3 font-semibold text-blue-600">
                Total OT
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">
                Avg/Day
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <>
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer"
                  onClick={() =>
                    setExpanded(expanded === row.id ? null : row.id)
                  }
                >
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {row.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {row.employeeCode}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {row.department}
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                      {row.otDays}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3 font-semibold text-blue-600 dark:text-blue-400">
                    {row.totalOTHours}h
                  </td>
                  <td className="text-center px-3 py-3 text-gray-500 hidden md:table-cell">
                    {row.avgOTPerDay}h
                  </td>
                  <td className="text-center px-3 py-3">
                    <button className="text-blue-600 dark:text-blue-400 text-xs hover:underline">
                      {expanded === row.id ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-details`}>
                    <td
                      colSpan={7}
                      className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20"
                    >
                      <div className="flex flex-wrap gap-2">
                        {row.dates.map((d) => (
                          <span
                            key={d.date}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                          >
                            <span className="font-medium">{d.date}</span>
                            <span className="text-blue-600">{d.otHours}h</span>
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

// ─── Report 5: Leave Summary Table ────────────────────────
function LeaveSummaryTable({ data }: { data: LeaveData[] }) {
  if (data.length === 0) return <EmptyState message="No leave data found." />;

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <StatCard label="Employees" value={data.length} />
        <StatCard
          label="Total Allocated"
          value={data.reduce((a, d) => a + d.totalAllocated, 0)}
          color="blue"
        />
        <StatCard
          label="Total Used"
          value={data.reduce((a, d) => a + d.totalUsed, 0)}
          color="red"
        />
        <StatCard
          label="Total Pending"
          value={data.reduce((a, d) => a + d.totalPending, 0)}
          color="yellow"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                #
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Employee
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                Dept
              </th>
              <th className="text-center px-3 py-3 font-semibold text-blue-600">
                Allocated
              </th>
              <th className="text-center px-3 py-3 font-semibold text-red-600">
                Used
              </th>
              <th className="text-center px-3 py-3 font-semibold text-yellow-600 hidden md:table-cell">
                Pending
              </th>
              <th className="text-center px-3 py-3 font-semibold text-green-600">
                Balance
              </th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.map((row, i) => (
              <>
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer"
                  onClick={() =>
                    setExpanded(expanded === row.id ? null : row.id)
                  }
                >
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {row.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {row.employeeCode}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {row.department}
                  </td>
                  <td className="text-center px-3 py-3 text-blue-600 font-medium">
                    {row.totalAllocated}
                  </td>
                  <td className="text-center px-3 py-3 text-red-600 font-medium">
                    {row.totalUsed}
                  </td>
                  <td className="text-center px-3 py-3 text-yellow-600 font-medium hidden md:table-cell">
                    {row.totalPending}
                  </td>
                  <td className="text-center px-3 py-3">
                    <span
                      className={cn(
                        "inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold",
                        row.totalBalance > 0
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      )}
                    >
                      {row.totalBalance.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3">
                    <button className="text-blue-600 dark:text-blue-400 text-xs hover:underline">
                      {expanded === row.id ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                {expanded === row.id && row.balances.length > 0 && (
                  <tr key={`${row.id}-details`}>
                    <td
                      colSpan={8}
                      className="px-4 py-3 bg-gray-50 dark:bg-gray-800/20"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {row.balances.map((b) => (
                          <div
                            key={b.code}
                            className="flex items-center justify-between px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                          >
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {b.leaveType}
                            </span>
                            <div className="flex gap-3">
                              <span className="text-blue-600">
                                A:{b.allocated}
                              </span>
                              <span className="text-red-600">U:{b.used}</span>
                              <span className="text-yellow-600">
                                P:{b.pending}
                              </span>
                              <span
                                className={
                                  b.balance > 0
                                    ? "text-green-600 font-semibold"
                                    : "text-red-600 font-semibold"
                                }
                              >
                                B:{b.balance}
                              </span>
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

// ─── Helper Components ────────────────────────────────────
function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  const colors: Record<string, string> = {
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
    blue: "text-blue-600 dark:text-blue-400",
    default: "text-gray-900 dark:text-white",
  };

  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn("text-xl font-bold", colors[color || "default"])}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <Card className="p-12 text-center">
      <div className="text-4xl mb-2">📭</div>
      <p className="text-gray-400 dark:text-gray-500">
        {message || "No records found for the selected filters."}
      </p>
    </Card>
  );
}
