"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────
interface OverviewData {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  lateArrivals: number;
  pendingApprovals: number;
  halfDay: number;
}

interface EmployeeDetail {
  id: string;
  name: string;
  employeeCode: string | null;
  department?: string;
  location?: string;
  role: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workMins: number;
  presentDays?: number;
  absentDays?: number;
  lateDays?: number;
  leaveDays?: number;
}

interface LocationStat {
  id: string;
  name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  employees: EmployeeDetail[];
}

interface DepartmentStat {
  id: string;
  name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  employees: EmployeeDetail[];
}

interface RecentActivity {
  id: string;
  type: "CHECK_IN" | "CHECK_OUT";
  employeeName: string;
  department: string;
  location: string;
  time: string;
  address?: string | null;
}

interface WeeklyTrend {
  date: string;
  fullDate: string;
  present: number;
}

interface MetaData {
  rangeStart: string;
  rangeEnd: string;
  numDays: number;
  isToday: boolean;
}

interface DashboardData {
  overview: OverviewData;
  locations: LocationStat[];
  departments: DepartmentStat[];
  employees: EmployeeDetail[];
  recentActivity: RecentActivity[];
  weeklyTrend: WeeklyTrend[];
  meta: MetaData;
}

type TabKey = "overview" | "locations" | "departments" | "employees" | "activity";
type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";
type StatusFilter = "ALL" | "PRESENT" | "ABSENT" | "LATE" | "ON_LEAVE" | "HALF_DAY";

// ─── Helpers ──────────────────────────────────────────────
function formatMins(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function getDateRange(preset: DatePreset, customStart?: string, customEnd?: string) {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return {};
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const ds = fmt(y);
      return { start: ds, end: ds };
    }
    case "week": {
      const s = new Date(now);
      s.setDate(s.getDate() - s.getDay());
      return { start: fmt(s), end: fmt(now) };
    }
    case "month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmt(s), end: fmt(now) };
    }
    case "custom":
      return { start: customStart, end: customEnd };
    default:
      return {};
  }
}

function statusBadge(status: string) {
  const map: Record<string, { variant: string; label: string }> = {
    PRESENT: { variant: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Present" },
    ABSENT: { variant: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Absent" },
    LATE: { variant: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Late" },
    ON_LEAVE: { variant: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", label: "On Leave" },
    HALF_DAY: { variant: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", label: "Half Day" },
  };
  const s = map[status] || { variant: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", label: status };
  return <Badge className={s.variant}>{s.label}</Badge>;
}

// ─── Date Range Picker ────────────────────────────────────
function DateRangePicker({
  preset,
  customStart,
  customEnd,
  onPresetChange,
  onCustomChange,
}: {
  preset: DatePreset;
  customStart: string;
  customEnd: string;
  onPresetChange: (p: DatePreset) => void;
  onCustomChange: (s: string, e: string) => void;
}) {
  const presets: { key: DatePreset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.key}
          onClick={() => onPresetChange(p.key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
            preset === p.key
              ? "bg-blue-600 text-white border-blue-600"
              : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          )}
        >
          {p.label}
        </button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomChange(e.target.value, customEnd)}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomChange(customStart, e.target.value)}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      )}
    </div>
  );
}

// ─── Overview Card ────────────────────────────────────────
function OverviewCard({
  label,
  value,
  icon,
  color,
  subtext,
  onClick,
  active,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  subtext?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
        active && "ring-2 ring-blue-500"
      )}
    >
      <div className="flex items-center justify-between" onClick={onClick}>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {subtext}
            </p>
          )}
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-xl",
            color
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Donut Chart ──────────────────────────────────────────
function AttendanceDonut({ overview }: { overview: OverviewData }) {
  const total = overview.totalEmployees || 1;
  const presentPct = Math.round((overview.presentToday / total) * 100);
  const absentPct = Math.round((overview.absentToday / total) * 100);
  const leavePct = Math.round((overview.onLeaveToday / total) * 100);
  const latePct = Math.round((overview.lateArrivals / total) * 100);
  const halfPct = Math.max(0, 100 - presentPct - absentPct - leavePct - latePct);

  const segments = [
    { label: "Present", pct: presentPct, color: "bg-green-500", hex: "#22c55e" },
    { label: "Absent", pct: absentPct, color: "bg-red-500", hex: "#ef4444" },
    { label: "On Leave", pct: leavePct, color: "bg-purple-500", hex: "#a855f7" },
    { label: "Late", pct: latePct, color: "bg-yellow-500", hex: "#eab308" },
    { label: "Half Day", pct: halfPct, color: "bg-orange-500", hex: "#f97316" },
  ].filter((s) => s.pct > 0);

  let acc = 0;
  const stops = segments.map((s) => {
    const start = acc;
    acc += s.pct;
    return `${s.hex} ${start}% ${acc}%`;
  }).join(", ");

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Attendance Breakdown
      </h3>
      <div className="flex items-center gap-6">
        <div
          className="w-32 h-32 rounded-full flex-shrink-0 relative"
          style={{ background: `conic-gradient(${stops || "#e5e7eb 0% 100%"})` }}
        >
          <div className="absolute inset-3 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{presentPct}%</p>
              <p className="text-[10px] text-gray-500">Present</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", s.color)} />
                <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
              </div>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Weekly Trend ─────────────────────────────────────────
function WeeklyTrendChart({ data, maxEmployees }: { data: WeeklyTrend[]; maxEmployees: number }) {
  const maxVal = Math.max(...data.map((d) => d.present), 1);

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Weekly Attendance Trend
      </h3>
      <div className="flex items-end justify-between gap-2 h-40">
        {data.map((day) => {
          const heightPct = (day.present / maxVal) * 100;
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-gray-900 dark:text-white">{day.present}</span>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-t-lg relative" style={{ height: "100%" }}>
                <div
                  className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg transition-all duration-500"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{day.date}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-2 text-right">of {maxEmployees} employees</p>
    </Card>
  );
}

// ─── Status Filter Chips ──────────────────────────────────
function StatusFilterChips({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: Record<string, number>;
}) {
  const filters: { key: StatusFilter; label: string; color: string }[] = [
    { key: "ALL", label: "All", color: "bg-gray-500" },
    { key: "PRESENT", label: "Present", color: "bg-green-500" },
    { key: "ABSENT", label: "Absent", color: "bg-red-500" },
    { key: "LATE", label: "Late", color: "bg-yellow-500" },
    { key: "ON_LEAVE", label: "On Leave", color: "bg-purple-500" },
    { key: "HALF_DAY", label: "Half Day", color: "bg-orange-500" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => {
        const count = f.key === "ALL" ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[f.key] || 0);
        if (f.key !== "ALL" && count === 0) return null;
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              value === f.key
                ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", f.color)} />
            {f.label}
            <span className="text-[10px] opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Employee Table ───────────────────────────────────────
function EmployeeTable({
  employees,
  showLocation,
  showDepartment,
  isRange,
}: {
  employees: EmployeeDetail[];
  showLocation?: boolean;
  showDepartment?: boolean;
  isRange?: boolean;
}) {
  if (employees.length === 0) {
    return <p className="py-4 text-sm text-gray-400 text-center">No employees found</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Employee</th>
            {showDepartment && (
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Dept</th>
            )}
            {showLocation && (
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Location</th>
            )}
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Check In</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Check Out</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Work Hrs</th>
            {isRange && (
              <>
                <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">P</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">A</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">L</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2 px-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{emp.name}</p>
                  <p className="text-[10px] text-gray-400">{emp.employeeCode || "—"}</p>
                </div>
              </td>
              {showDepartment && (
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400 text-xs hidden sm:table-cell">{emp.department || "—"}</td>
              )}
              {showLocation && (
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400 text-xs hidden sm:table-cell">{emp.location || "—"}</td>
              )}
              <td className="py-2 px-3 text-center">{statusBadge(emp.status)}</td>
              <td className="py-2 px-3 text-center text-xs text-gray-600 dark:text-gray-400 hidden md:table-cell">{emp.checkIn || "—"}</td>
              <td className="py-2 px-3 text-center text-xs text-gray-600 dark:text-gray-400 hidden md:table-cell">{emp.checkOut || "—"}</td>
              <td className="py-2 px-3 text-center text-xs text-gray-600 dark:text-gray-400 hidden lg:table-cell">{formatMins(emp.workMins)}</td>
              {isRange && (
                <>
                  <td className="py-2 px-3 text-center text-xs text-green-600 dark:text-green-400 font-medium hidden lg:table-cell">{emp.presentDays ?? 0}</td>
                  <td className="py-2 px-3 text-center text-xs text-red-600 dark:text-red-400 font-medium hidden lg:table-cell">{emp.absentDays ?? 0}</td>
                  <td className="py-2 px-3 text-center text-xs text-purple-600 dark:text-purple-400 font-medium hidden lg:table-cell">{emp.leaveDays ?? 0}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Expandable Group Table (Location / Department) ───────
function GroupTable({
  groups,
  groupLabel,
  showColumnLabel,
  isRange,
}: {
  groups: (LocationStat | DepartmentStat)[];
  groupLabel: string;
  showColumnLabel: string;
  isRange?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
    setStatusFilter("ALL");
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isOpen = expanded === group.id;
        const empCounts: Record<string, number> = {};
        group.employees.forEach((e) => {
          empCounts[e.status] = (empCounts[e.status] || 0) + 1;
        });

        const filteredEmployees =
          statusFilter === "ALL"
            ? group.employees
            : group.employees.filter((e) => e.status === statusFilter);

        const total = group.total || 1;
        const presentPct = (group.present / total) * 100;
        const absentPct = (group.absent / total) * 100;
        const latePct = (group.late / total) * 100;
        const leavePct = (group.onLeave / total) * 100;

        return (
          <Card key={group.id} padding={false}>
            <button onClick={() => toggle(group.id)} className="w-full text-left p-4 sm:p-5 focus:outline-none">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{group.name}</h4>
                  <span className="text-xs text-gray-400">({group.total} employees)</span>
                </div>
                <svg
                  className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", isOpen && "rotate-180")}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center mb-3">
                <div>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{group.present}</p>
                  <p className="text-[10px] text-gray-500">Present</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{group.absent}</p>
                  <p className="text-[10px] text-gray-500">Absent</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{group.late}</p>
                  <p className="text-[10px] text-gray-500">Late</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{group.onLeave}</p>
                  <p className="text-[10px] text-gray-500">On Leave</p>
                </div>
              </div>

              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                {presentPct > 0 && <div className="bg-green-500 h-full" style={{ width: `${presentPct}%` }} />}
                {latePct > 0 && <div className="bg-yellow-500 h-full" style={{ width: `${latePct}%` }} />}
                {leavePct > 0 && <div className="bg-purple-500 h-full" style={{ width: `${leavePct}%` }} />}
                {absentPct > 0 && <div className="bg-red-500 h-full" style={{ width: `${absentPct}%` }} />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-200 dark:border-gray-800 px-4 pb-4">
                <div className="pt-3 pb-2">
                  <StatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={empCounts} />
                </div>
                <EmployeeTable
                  employees={filteredEmployees}
                  showLocation={showColumnLabel === "Location"}
                  showDepartment={showColumnLabel === "Department"}
                  isRange={isRange}
                />
              </div>
            )}
          </Card>
        );
      })}
      {groups.length === 0 && (
        <Card>
          <p className="py-6 text-center text-sm text-gray-400">No {groupLabel.toLowerCase()} data available</p>
        </Card>
      )}
    </div>
  );
}

// ─── Recent Activity Feed ─────────────────────────────────
function RecentActivityFeed({ activities }: { activities: RecentActivity[] }) {
  const [filterType, setFilterType] = useState<"ALL" | "CHECK_IN" | "CHECK_OUT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let list = activities;
    if (filterType !== "ALL") list = list.filter((a) => a.type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.employeeName.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activities, filterType, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {(["ALL", "CHECK_IN", "CHECK_OUT"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                filterType === t
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              {t === "ALL" ? "All" : t === "CHECK_IN" ? "Check In" : "Check Out"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by name, dept, location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex-1 sm:max-w-xs"
        />
      </div>

      <Card>
        <div className="space-y-1">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0",
                  a.type === "CHECK_IN"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                )}
              >
                {a.type === "CHECK_IN" ? "↓" : "↑"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.employeeName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{a.department} · {a.location}</p>
                {a.address && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5" title={a.address}>
                    📍 {a.address}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <Badge className={a.type === "CHECK_IN" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}>
                  {a.type === "CHECK_IN" ? "In" : "Out"}
                </Badge>
                <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No activity found</p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── All Employees Tab ────────────────────────────────────
function AllEmployeesTab({ employees, isRange }: { employees: EmployeeDetail[]; isRange: boolean }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "status" | "workMins">("name");

  const empCounts: Record<string, number> = {};
  employees.forEach((e) => {
    empCounts[e.status] = (empCounts[e.status] || 0) + 1;
  });

  const filtered = useMemo(() => {
    let list = employees;
    if (statusFilter !== "ALL") list = list.filter((e) => e.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.department || "").toLowerCase().includes(q) ||
          (e.location || "").toLowerCase().includes(q) ||
          (e.employeeCode || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      if (sortBy === "workMins") return (b.workMins || 0) - (a.workMins || 0);
      return 0;
    });
    return list;
  }, [employees, statusFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <StatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={empCounts} />
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Search name, dept, location, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex-1 sm:max-w-xs"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
            <option value="workMins">Sort: Work Hours</option>
          </select>
        </div>
      </div>

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500">Showing {filtered.length} of {employees.length} employees</p>
        </div>
        <div className="p-0">
          <EmployeeTable employees={filtered} showLocation showDepartment isRange={isRange} />
        </div>
      </Card>
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────
function TabBar({ activeTab, onChange, counts }: { activeTab: TabKey; onChange: (t: TabKey) => void; counts: Record<TabKey, number> }) {
  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "locations", label: "Locations", icon: "📍" },
    { key: "departments", label: "Departments", icon: "🏢" },
    { key: "employees", label: "Employees", icon: "👥" },
    { key: "activity", label: "Activity", icon: "⚡" },
  ];

  return (
    <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-800 -mx-4 px-4 gap-1 scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
            activeTab === tab.key
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
          )}
        >
          <span className="text-sm">{tab.icon}</span>
          <span>{tab.label}</span>
          {tab.key !== "overview" && (
            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">
              {counts[tab.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export function ManagementDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const range = getDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams();
      if (range.start) params.set("start", range.start);
      if (range.end) params.set("end", range.end);
      const qs = params.toString();
      const url = `/api/management${qs ? `?${qs}` : ""}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || "Failed to load data");
      }
    } catch {
      setError("Failed to load management dashboard");
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handlePresetChange = (p: DatePreset) => {
    setDatePreset(p);
    if (p === "custom" && !customStart) {
      const now = new Date();
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      setCustomStart(fmt(now));
      setCustomEnd(fmt(now));
    }
  };

  const handleCustomChange = (s: string, e: string) => {
    setCustomStart(s);
    setCustomEnd(e);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Management Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Management Dashboard</h2>
        <Card>
          <div className="py-8 text-center">
            <p className="text-red-500">{error}</p>
            <button onClick={fetchData} className="mt-2 text-sm text-blue-600 hover:underline">Retry</button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { overview, locations, departments, employees, recentActivity, weeklyTrend, meta } = data;
  const presentPct = overview.totalEmployees ? Math.round((overview.presentToday / overview.totalEmployees) * 100) : 0;
  const isRange = meta.numDays > 1;

  const tabCounts: Record<TabKey, number> = {
    overview: 0,
    locations: locations.length,
    departments: departments.length,
    employees: employees.length,
    activity: recentActivity.length,
  };

  const rangeLabel = (() => {
    if (meta.isToday) return new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (meta.numDays === 1) {
      return new Date(meta.rangeStart).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    }
    const s = new Date(meta.rangeStart).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const e = new Date(meta.rangeEnd).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e} (${meta.numDays} days)`;
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Management Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{rangeLabel}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} loading={loading}>
          ↻ Refresh
        </Button>
      </div>

      {/* Date Range Picker */}
      <DateRangePicker
        preset={datePreset}
        customStart={customStart}
        customEnd={customEnd}
        onPresetChange={handlePresetChange}
        onCustomChange={handleCustomChange}
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <OverviewCard label="Total Staff" value={overview.totalEmployees} icon="👥" color="bg-blue-100 dark:bg-blue-900/30" />
        <OverviewCard label="Present" value={overview.presentToday} icon="✅" color="bg-green-100 dark:bg-green-900/30" subtext={`${presentPct}%`} onClick={() => setActiveTab("employees")} />
        <OverviewCard label="Absent" value={overview.absentToday} icon="❌" color="bg-red-100 dark:bg-red-900/30" onClick={() => setActiveTab("employees")} />
        <OverviewCard label="On Leave" value={overview.onLeaveToday} icon="🏖️" color="bg-purple-100 dark:bg-purple-900/30" onClick={() => setActiveTab("employees")} />
        <OverviewCard label="Late" value={overview.lateArrivals} icon="⏰" color="bg-yellow-100 dark:bg-yellow-900/30" onClick={() => setActiveTab("employees")} />
        <OverviewCard label="Half Day" value={overview.halfDay} icon="🕐" color="bg-orange-100 dark:bg-orange-900/30" onClick={() => setActiveTab("employees")} />
        <OverviewCard label="Pending" value={overview.pendingApprovals} icon="📋" color="bg-amber-100 dark:bg-amber-900/30" subtext="Approvals" />
      </div>

      {/* Tabs */}
      <TabBar activeTab={activeTab} onChange={setActiveTab} counts={tabCounts} />

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AttendanceDonut overview={overview} />
              <WeeklyTrendChart data={weeklyTrend} maxEmployees={overview.totalEmployees} />
            </div>

            {/* Quick Location Summary */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Location Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Location</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Total</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Present</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Absent</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Late</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Leave</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => {
                      const pct = loc.total ? Math.round((loc.present / loc.total) * 100) : 0;
                      return (
                        <tr
                          key={loc.id}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          onClick={() => setActiveTab("locations")}
                        >
                          <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{loc.name}</td>
                          <td className="py-2.5 px-3 text-center text-gray-600 dark:text-gray-400">{loc.total}</td>
                          <td className="py-2.5 px-3 text-center"><span className="text-green-600 dark:text-green-400 font-medium">{loc.present}</span></td>
                          <td className="py-2.5 px-3 text-center"><span className="text-red-600 dark:text-red-400 font-medium">{loc.absent}</span></td>
                          <td className="py-2.5 px-3 text-center"><span className="text-yellow-600 dark:text-yellow-400 font-medium">{loc.late}</span></td>
                          <td className="py-2.5 px-3 text-center"><span className="text-purple-600 dark:text-purple-400 font-medium">{loc.onLeave}</span></td>
                          <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-500">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {locations.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-400">No locations found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {locations.length > 0 && (
                <button onClick={() => setActiveTab("locations")} className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  View all locations with employee drilldown →
                </button>
              )}
            </Card>

            {/* Quick Department Summary */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Department Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Department</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Total</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Present</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Absent</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Late</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Leave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr
                        key={dept.id}
                        className="border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        onClick={() => setActiveTab("departments")}
                      >
                        <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{dept.name}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600 dark:text-gray-400">{dept.total}</td>
                        <td className="py-2.5 px-3 text-center text-green-600 dark:text-green-400 font-medium">{dept.present}</td>
                        <td className="py-2.5 px-3 text-center text-red-600 dark:text-red-400 font-medium">{dept.absent}</td>
                        <td className="py-2.5 px-3 text-center text-yellow-600 dark:text-yellow-400 font-medium">{dept.late}</td>
                        <td className="py-2.5 px-3 text-center text-purple-600 dark:text-purple-400 font-medium">{dept.onLeave}</td>
                      </tr>
                    ))}
                    {departments.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-gray-400">No departments found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {departments.length > 0 && (
                <button onClick={() => setActiveTab("departments")} className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  View all departments with employee drilldown →
                </button>
              )}
            </Card>
          </div>
        )}

        {/* Locations Tab */}
        {activeTab === "locations" && (
          <GroupTable groups={locations} groupLabel="Locations" showColumnLabel="Department" isRange={isRange} />
        )}

        {/* Departments Tab */}
        {activeTab === "departments" && (
          <GroupTable groups={departments} groupLabel="Departments" showColumnLabel="Location" isRange={isRange} />
        )}

        {/* Employees Tab */}
        {activeTab === "employees" && (
          <AllEmployeesTab employees={employees} isRange={isRange} />
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <RecentActivityFeed activities={recentActivity} />
        )}
      </div>
    </div>
  );
}
