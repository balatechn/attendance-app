"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, Badge, Button, Input } from "@/components/ui";
import { STATUS_COLORS } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────
interface DayData {
  date: string;
  dayName: string;
  dayNum: number;
  dayOfWeek: number;
  isToday: boolean;
  isSunday: boolean;
  status: string;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  totalWorkMins: number;
  sessions: Array<{
    id: string;
    type: "CHECK_IN" | "CHECK_OUT";
    timestamp: string;
    address?: string | null;
    note?: string | null;
  }>;
}

interface ShiftInfo {
  name: string;
  startTime: string;
  endTime: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  department: { name: string } | null;
}

interface Props {
  days: DayData[];
  year: number;
  month: number; // 1-12
  firstDayOfWeek: number; // 0=Sun
  monthLabel: string;
  shift: ShiftInfo | null;
  teamMembers: TeamMember[];
  selectedEmployeeId: string | null;
  selectedEmployeeName: string | null;
  canViewTeam: boolean;
}

// ─── Helpers ──────────────────────────────────────────────
function formatTimeFromISO(iso: string): string {
  const d = new Date(iso);
  const utcMins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const istMins = (utcMins + 330) % 1440;
  const adjH = Math.floor(istMins / 60);
  const adjM = istMins % 60;
  const ampm = adjH >= 12 ? "PM" : "AM";
  const h12 = adjH % 12 || 12;
  return `${h12}:${String(adjM).padStart(2, "0")} ${ampm}`;
}

function formatMinsToHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  LATE: "Late",
  ON_LEAVE: "On Leave",
};

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Main Component ───────────────────────────────────────
export function AttendancePageClient({
  days: initialDays,
  year: initialYear,
  month: initialMonth,
  firstDayOfWeek: initialFirstDay,
  monthLabel: initialMonthLabel,
  shift,
  teamMembers,
  selectedEmployeeId,
  selectedEmployeeName,
  canViewTeam,
}: Props) {
  // Client-side month state
  const [days, setDays] = useState<DayData[]>(initialDays);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(initialFirstDay);
  const [monthLabel, setMonthLabel] = useState(initialMonthLabel);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(selectedEmployeeId);

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Regularization form state
  const [showRegForm, setShowRegForm] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState("");
  const [regError, setRegError] = useState("");
  const [regForm, setRegForm] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "MISSED_CHECK_IN",
    reason: "",
  });

  // Live timer
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Today's live timer
  const todayData = days.find((d) => d.isToday);
  const liveTimerStr = useMemo(() => {
    if (!todayData || todayData.sessions.length === 0) return null;
    const sorted = [...todayData.sessions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    let totalSecs = 0;
    let lastIn: Date | null = null;
    for (const s of sorted) {
      if (s.type === "CHECK_IN") lastIn = new Date(s.timestamp);
      else if (s.type === "CHECK_OUT" && lastIn) {
        totalSecs += (new Date(s.timestamp).getTime() - lastIn.getTime()) / 1000;
        lastIn = null;
      }
    }
    if (lastIn) totalSecs += (now.getTime() - lastIn.getTime()) / 1000;
    if (totalSecs <= 0) return null;
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = Math.floor(totalSecs % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [todayData, now]);

  const isCheckedIn = useMemo(() => {
    if (!todayData) return false;
    const sorted = [...todayData.sessions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return sorted.length > 0 && sorted[sorted.length - 1].type === "CHECK_IN";
  }, [todayData]);

  // Client-side month fetch
  const fetchMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setExpandedDay(null);
    try {
      const params = new URLSearchParams({ month: `${y}-${String(m).padStart(2, "0")}` });
      if (selectedEmployee) params.set("employee", selectedEmployee);
      const res = await fetch(`/api/attendance/weekly?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDays(json.data.days);
        setYear(json.data.year);
        setMonth(json.data.month);
        setFirstDayOfWeek(json.data.firstDayOfWeek);
        setMonthLabel(json.data.monthLabel);
      }
    } catch (err) {
      console.error("Failed to fetch month data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee]);

  // Fetch for a specific employee (used by employee selector)
  const fetchMonthForEmployee = useCallback(async (y: number, m: number, empId: string | null) => {
    setLoading(true);
    setExpandedDay(null);
    try {
      const params = new URLSearchParams({ month: `${y}-${String(m).padStart(2, "0")}` });
      if (empId) params.set("employee", empId);
      const res = await fetch(`/api/attendance/weekly?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDays(json.data.days);
        setYear(json.data.year);
        setMonth(json.data.month);
        setFirstDayOfWeek(json.data.firstDayOfWeek);
        setMonthLabel(json.data.monthLabel);
      }
    } catch (err) {
      console.error("Failed to fetch month data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateMonth = useCallback((dir: number) => {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    fetchMonth(newYear, newMonth);
  }, [year, month, fetchMonth]);

  const goToThisMonth = useCallback(() => {
    const now = new Date();
    fetchMonth(now.getFullYear(), now.getMonth() + 1);
  }, [fetchMonth]);

  const handleRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(""); setRegSuccess(""); setRegLoading(true);
    try {
      const res = await fetch("/api/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!data.success) { setRegError(data.error?.message || "Failed to submit"); return; }
      setRegSuccess("Regularization request submitted!");
      setRegForm({ date: new Date().toISOString().split("T")[0], type: "MISSED_CHECK_IN", reason: "" });
      setTimeout(() => { setShowRegForm(false); setRegSuccess(""); }, 3000);
    } catch { setRegError("Something went wrong"); }
    finally { setRegLoading(false); }
  };

  // Monthly summary stats
  const monthStats = useMemo(() => {
    let present = 0, absent = 0, late = 0, halfDay = 0, onLeave = 0, totalWorkMins = 0;
    for (const d of days) {
      if (d.status === "PRESENT") present++;
      else if (d.status === "ABSENT") absent++;
      else if (d.status === "LATE") { late++; present++; }
      else if (d.status === "HALF_DAY") halfDay++;
      else if (d.status === "ON_LEAVE") onLeave++;
      totalWorkMins += d.totalWorkMins;
    }
    return { present, absent, late, halfDay, onLeave, totalWorkMins };
  }, [days]);

  // Build calendar grid cells
  const calendarCells = useMemo(() => {
    const cells: (DayData | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (const d of days) cells.push(d);
    return cells;
  }, [days, firstDayOfWeek]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Attendance</h2>
          {selectedEmployee && (
            <Badge variant="info" className="text-xs">Viewing: {teamMembers.find(m => m.id === selectedEmployee)?.name || selectedEmployeeName}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canViewTeam && (
            <select
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 max-w-[200px]"
              value={selectedEmployee || ""}
              onChange={(e) => {
                const val = e.target.value;
                // Use client-side fetch + URL update (no full reload)
                const url = val ? `/dashboard/attendance?employee=${val}` : "/dashboard/attendance";
                window.history.replaceState(null, "", url);
                setSelectedEmployee(val || null);
                fetchMonthForEmployee(year, month, val || null);
              }}
            >
              <option value="">My Attendance</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.department ? ` (${m.department.name})` : ""}
                </option>
              ))}
            </select>
          )}
          {!selectedEmployee && (
            <Button
              size="sm"
              variant={showRegForm ? "outline" : "primary"}
              onClick={() => { setShowRegForm(!showRegForm); setRegError(""); setRegSuccess(""); }}
            >
              {showRegForm ? "Cancel" : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Regularization
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Regularization Form */}
      {showRegForm && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Request Attendance Regularization</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Submit a request for attendance correction.</p>
          <form onSubmit={handleRegSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Date" type="date" value={regForm.date} onChange={(e) => setRegForm({ ...regForm, date: e.target.value })} required />
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select value={regForm.type} onChange={(e) => setRegForm({ ...regForm, type: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
                  <option value="MISSED_CHECK_IN">Missed Check-In</option>
                  <option value="MISSED_CHECK_OUT">Missed Check-Out</option>
                  <option value="WRONG_TIME">Wrong Time Recorded</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
              <textarea value={regForm.reason} onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })} rows={3} required placeholder="Please explain the reason..." className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 resize-none" />
            </div>
            {regError && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{regError}</div>}
            {regSuccess && <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm px-3 py-2 rounded-lg">{regSuccess}</div>}
            <Button type="submit" loading={regLoading} size="sm">Submit Request</Button>
          </form>
        </Card>
      )}

      {/* Today Status Banner */}
      {todayData && todayData.sessions.length > 0 && (
        <Card className="!py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isCheckedIn ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {isCheckedIn ? "Currently Working" : "Checked Out"}
                </span>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {todayData.firstCheckIn && (
                    <span>In: <span className="text-green-600 dark:text-green-400 font-medium">{formatTimeFromISO(todayData.firstCheckIn)}</span></span>
                  )}
                  {todayData.lastCheckOut && (
                    <span>Out: <span className="text-red-600 dark:text-red-400 font-medium">{formatTimeFromISO(todayData.lastCheckOut)}</span></span>
                  )}
                </div>
              </div>
            </div>
            {liveTimerStr && (
              <div className="text-right">
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">{liveTimerStr}</span>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Today&apos;s Hours</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Month Summary Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "Present", value: monthStats.present, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" },
          { label: "Absent", value: monthStats.absent, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
          { label: "Late", value: monthStats.late, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
          { label: "Half Day", value: monthStats.halfDay, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
          { label: "On Leave", value: monthStats.onLeave, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
          { label: "Total Hrs", value: formatMinsToHM(monthStats.totalWorkMins), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl px-3 py-2.5 text-center`}>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar Card */}
      <Card className="!p-0 overflow-hidden relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 z-20 flex items-center justify-center backdrop-blur-[1px]">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Month Navigation */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1">
            <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={goToThisMonth} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" title="Current month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{monthLabel}</span>

          {shift && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="font-medium">{shift.name}</span>
              <span className="text-gray-400 dark:text-gray-500">[ {shift.startTime} - {shift.endTime} ]</span>
            </div>
          )}
          {!shift && <div className="w-1" />}
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className={`text-center py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
              d === "Sun" ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"
            }`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarCells.map((day, idx) => {
            if (!day) {
              return (
                <div key={`empty-${idx}`} className="min-h-[80px] sm:min-h-[100px] bg-gray-50/50 dark:bg-gray-800/20 border-b border-r border-gray-100 dark:border-gray-800" />
              );
            }

            const isExpanded = expandedDay === day.date;
            const isFuture = new Date(day.date + "T23:59:59") > new Date();

            return (
              <div
                key={day.date}
                className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 dark:border-gray-800 cursor-pointer transition-colors relative ${
                  day.isToday
                    ? "bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-inset ring-blue-300 dark:ring-blue-700"
                    : day.isSunday
                    ? "bg-red-50/30 dark:bg-red-950/10"
                    : isExpanded
                    ? "bg-gray-50 dark:bg-gray-800/40"
                    : "hover:bg-gray-50/70 dark:hover:bg-gray-800/30"
                }`}
                onClick={() => setExpandedDay(isExpanded ? null : day.date)}
              >
                {/* Day number & status dot */}
                <div className="flex items-start justify-between px-1.5 sm:px-2 pt-1.5 sm:pt-2">
                  <span className={`text-xs sm:text-sm font-bold leading-none ${
                    day.isToday
                      ? "bg-blue-600 text-white w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs"
                      : day.isSunday
                      ? "text-red-500 dark:text-red-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {day.dayNum}
                  </span>

                  {day.status && (
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                      day.status === "PRESENT" ? "bg-green-500" :
                      day.status === "ABSENT" ? "bg-red-500" :
                      day.status === "LATE" ? "bg-amber-500" :
                      day.status === "HALF_DAY" ? "bg-orange-500" :
                      day.status === "ON_LEAVE" ? "bg-purple-500" :
                      "bg-gray-400"
                    }`} />
                  )}
                </div>

                {/* Check-in/out times */}
                {day.sessions.length > 0 && (
                  <div className="px-1.5 sm:px-2 mt-1 space-y-0.5">
                    {day.firstCheckIn && (
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-green-700 dark:text-green-400 font-medium truncate">{formatTimeFromISO(day.firstCheckIn)}</span>
                      </div>
                    )}
                    {day.lastCheckOut && (
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-red-700 dark:text-red-400 font-medium truncate">{formatTimeFromISO(day.lastCheckOut)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total hours */}
                {day.totalWorkMins > 0 && (
                  <div className="px-1.5 sm:px-2 mt-0.5">
                    <span className="text-[8px] sm:text-[9px] text-gray-400 dark:text-gray-500 font-medium">{formatMinsToHM(day.totalWorkMins)}</span>
                  </div>
                )}

                {/* Status label for leave/absent */}
                {day.sessions.length === 0 && day.status && !isFuture && (
                  <div className="px-1.5 sm:px-2 mt-2">
                    <span className={`text-[8px] sm:text-[9px] font-medium ${
                      day.status === "ON_LEAVE" ? "text-purple-500 dark:text-purple-400" :
                      day.status === "ABSENT" ? "text-red-500 dark:text-red-400" :
                      "text-gray-400"
                    }`}>
                      {STATUS_LABEL[day.status] || day.status.replace("_", " ")}
                    </span>
                  </div>
                )}

                {/* Sunday label */}
                {day.isSunday && day.sessions.length === 0 && !day.status && (
                  <div className="px-1.5 sm:px-2 mt-2">
                    <span className="text-[8px] sm:text-[9px] text-red-400 dark:text-red-500 font-medium">Holiday</span>
                  </div>
                )}

                {/* Live indicator */}
                {day.isToday && isCheckedIn && (
                  <div className="absolute bottom-1 right-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Expanded Day Detail */}
      {expandedDay && (() => {
        const day = days.find((d) => d.date === expandedDay);
        if (!day) return null;
        const statusColor = day.status ? STATUS_COLORS[day.status] || "secondary" : "secondary";

        return (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {day.dayName}, {day.dayNum} {new Date(day.date + "T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })}
                </h3>
                {day.status && <Badge variant={statusColor} className="text-[10px]">{STATUS_LABEL[day.status] || day.status.replace("_", " ")}</Badge>}
              </div>
              <button
                onClick={() => setExpandedDay(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Summary */}
            <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
              {day.firstCheckIn && (
                <span>First In: <span className="text-green-600 dark:text-green-400 font-semibold">{formatTimeFromISO(day.firstCheckIn)}</span></span>
              )}
              {day.lastCheckOut && (
                <span>Last Out: <span className="text-red-600 dark:text-red-400 font-semibold">{formatTimeFromISO(day.lastCheckOut)}</span></span>
              )}
              <span>Total: <span className="font-semibold text-gray-700 dark:text-gray-300">{formatMinsToHM(day.totalWorkMins)}</span></span>
            </div>

            {/* Sessions */}
            {day.sessions.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Sessions</h4>
                <div className="space-y-1.5">
                  {day.sessions.map((s) => (
                    <div key={s.id} className="flex items-start gap-2.5 text-xs">
                      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${s.type === "CHECK_IN" ? "bg-green-500" : "bg-red-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{formatTimeFromISO(s.timestamp)}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            s.type === "CHECK_IN"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                          }`}>
                            {s.type === "CHECK_IN" ? "CHECK IN" : "CHECK OUT"}
                          </span>
                        </div>
                        {s.address && <p className="text-gray-400 dark:text-gray-500 mt-0.5 truncate">📍 {s.address}</p>}
                        {s.note && <p className="text-blue-500 dark:text-blue-400 mt-0.5 truncate">💬 {s.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">No sessions recorded for this day.</p>
            )}
          </Card>
        );
      })()}
    </div>
  );
}
