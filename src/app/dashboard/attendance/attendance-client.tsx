"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, Input } from "@/components/ui";
import { STATUS_COLORS } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────
interface DayData {
  date: string; // yyyy-MM-dd
  dayName: string; // Mon, Tue, etc.
  dayNum: number; // 1-31
  isToday: boolean;
  isWeekend: boolean; // Sunday
  status: string; // PRESENT, ABSENT, HALF_DAY, LATE, ON_LEAVE, ""
  firstCheckIn: string | null; // ISO
  lastCheckOut: string | null; // ISO
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
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  department: { name: string } | null;
}

interface Props {
  weekDays: DayData[];
  weekStart: string; // yyyy-MM-dd
  weekEnd: string; // yyyy-MM-dd
  shift: ShiftInfo | null;
  teamMembers: TeamMember[];
  selectedEmployeeId: string | null;
  selectedEmployeeName: string | null;
  canViewTeam: boolean;
}

// ─── Helpers ──────────────────────────────────────────────
function formatTimeFromISO(iso: string): string {
  const d = new Date(iso);
  // Convert to IST manually
  const utcMins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const istMins = utcMins + 330; // +5:30
  const adjH = Math.floor((istMins % 1440) / 60);
  const adjM = (istMins % 1440) % 60;
  const ampm = adjH >= 12 ? "PM" : "AM";
  const h12 = adjH % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(adjM).padStart(2, "0")} ${ampm}`;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function isoToMinutesIST(iso: string): number {
  const d = new Date(iso);
  const utcMins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (utcMins + 330) % 1440;
}

function formatMinsToHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// ─── Main Component ───────────────────────────────────────
export function AttendancePageClient({
  weekDays: initialWeekDays, weekStart: initialWeekStart, weekEnd: initialWeekEnd, shift,
  teamMembers, selectedEmployeeId, selectedEmployeeName, canViewTeam,
}: Props) {
  const router = useRouter();

  // Client-side week state (initialized from server props)
  const [weekDays, setWeekDays] = useState<DayData[]>(initialWeekDays);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [weekEnd, setWeekEnd] = useState(initialWeekEnd);
  const [weekLoading, setWeekLoading] = useState(false);

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

  // Expanded day for detail view
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Timeline range based on shift
  const shiftStartMin = shift ? timeToMinutes(shift.startTime) : 8 * 60;
  const shiftEndMin = shift ? timeToMinutes(shift.endTime) : 18 * 60;
  const timelineStart = Math.max(0, shiftStartMin - 60);
  const timelineEnd = Math.min(1440, shiftEndMin + 180);
  const timelineRange = timelineEnd - timelineStart;

  // Hour markers for header
  const hourMarkers = useMemo(() => {
    const markers: { label: string; pos: number }[] = [];
    const startHour = Math.ceil(timelineStart / 60);
    const endHour = Math.floor(timelineEnd / 60);
    for (let h = startHour; h <= endHour; h++) {
      const pos = ((h * 60 - timelineStart) / timelineRange) * 100;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      markers.push({ label: `${h12}${ampm}`, pos });
    }
    return markers;
  }, [timelineStart, timelineEnd, timelineRange]);

  // Current time position
  const nowIST = useMemo(() => {
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    return (utcMins + 330) % 1440;
  }, [now]);
  const nowPos = ((nowIST - timelineStart) / timelineRange) * 100;

  // Client-side week fetch (no page reload)
  const fetchWeek = useCallback(async (ws: string) => {
    setWeekLoading(true);
    setExpandedDay(null);
    try {
      const params = new URLSearchParams({ week: ws });
      if (selectedEmployeeId) params.set("employee", selectedEmployeeId);
      const res = await fetch(`/api/attendance/weekly?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setWeekDays(json.data.weekDays);
        setWeekStart(json.data.weekStart);
        setWeekEnd(json.data.weekEnd);
      }
    } catch (err) {
      console.error("Failed to fetch week data:", err);
    } finally {
      setWeekLoading(false);
    }
  }, [selectedEmployeeId]);

  // Navigation
  const navigateWeek = useCallback((dir: number) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    const ws = d.toISOString().split("T")[0];
    fetchWeek(ws);
  }, [weekStart, fetchWeek]);

  const goToThisWeek = useCallback(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    const ws = d.toISOString().split("T")[0];
    fetchWeek(ws);
  }, [fetchWeek]);

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

  // Compute work bar segments for a day
  const getDayBars = useCallback((day: DayData) => {
    if (day.isWeekend && day.sessions.length === 0) return [];
    const bars: { left: number; width: number; isActive: boolean }[] = [];
    const sorted = [...day.sessions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    let i = 0;
    while (i < sorted.length) {
      if (sorted[i].type === "CHECK_IN") {
        const checkInMin = isoToMinutesIST(sorted[i].timestamp);
        let checkOutMin: number;
        if (i + 1 < sorted.length && sorted[i + 1].type === "CHECK_OUT") {
          checkOutMin = isoToMinutesIST(sorted[i + 1].timestamp);
          i += 2;
        } else if (day.isToday) {
          checkOutMin = nowIST;
          i += 1;
        } else {
          i += 1;
          continue;
        }
        const left = ((checkInMin - timelineStart) / timelineRange) * 100;
        const width = ((checkOutMin - checkInMin) / timelineRange) * 100;
        bars.push({ left: Math.max(0, left), width: Math.max(0.5, width), isActive: day.isToday && checkOutMin === nowIST });
      } else {
        i += 1;
      }
    }
    return bars;
  }, [timelineStart, timelineRange, nowIST]);

  // Today's data & live timer
  const todayData = weekDays.find((d) => d.isToday);
  const liveTimerStr = useMemo(() => {
    if (!todayData || todayData.sessions.length === 0) return null;
    const sorted = [...todayData.sessions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    let totalSecs = 0;
    let lastIn: Date | null = null;
    for (const s of sorted) {
      if (s.type === "CHECK_IN") { lastIn = new Date(s.timestamp); }
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Attendance</h2>
          {selectedEmployeeName && (
            <Badge variant="info" className="text-xs">Viewing: {selectedEmployeeName}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canViewTeam && (
            <select
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 max-w-[200px]"
              value={selectedEmployeeId || ""}
              onChange={(e) => {
                const val = e.target.value;
                router.push(val ? `/dashboard/attendance?employee=${val}` : "/dashboard/attendance");
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
          {!selectedEmployeeId && (
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Submit a request to your manager for attendance correction.</p>
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

      {/* Weekly Timeline Card */}
      <Card className="!p-0 overflow-hidden relative">
        {/* Loading overlay */}
        {weekLoading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 z-10 flex items-center justify-center backdrop-blur-[1px] transition-opacity">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {/* Week navigation bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1">
            <button onClick={() => navigateWeek(-1)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={goToThisWeek} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" title="Current week">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={() => navigateWeek(1)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {formatDisplayDate(weekStart)} &nbsp;—&nbsp; {formatDisplayDate(weekEnd)}
          </span>

          {shift && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="font-medium">{shift.name}</span>
              <span className="text-gray-400 dark:text-gray-500">[ {shift.startTime} - {shift.endTime} ]</span>
            </div>
          )}
          {!shift && <div className="w-1" />}
        </div>

        {/* Mobile shift info */}
        {shift && (
          <div className="sm:hidden flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-medium">{shift.name}</span>
            <span>[ {shift.startTime} - {shift.endTime} ]</span>
          </div>
        )}

        {/* Timeline Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex">
            <div className="w-[72px] sm:w-24 shrink-0" />
            <div className="flex-1 relative h-7 min-w-0">
              {hourMarkers.map((m) => (
                <div key={m.label} className="absolute top-0 bottom-0" style={{ left: `${m.pos}%` }}>
                  <div className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 absolute left-1/2 -translate-x-1/2 top-3 whitespace-nowrap">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="w-[72px] sm:w-24 shrink-0" />
          </div>
        </div>

        {/* Day rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {weekDays.map((day) => {
            const bars = getDayBars(day);
            const isExpanded = expandedDay === day.date;
            const statusColor = day.status ? STATUS_COLORS[day.status] || "secondary" : "secondary";

            return (
              <div key={day.date}>
                <div
                  className={`flex items-center cursor-pointer transition-colors ${
                    day.isToday
                      ? "bg-blue-50/60 dark:bg-blue-950/20"
                      : "hover:bg-gray-50/70 dark:hover:bg-gray-800/30"
                  }`}
                  onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                >
                  {/* Day label */}
                  <div className="w-[72px] sm:w-24 shrink-0 px-2 sm:px-3 py-3 sm:py-4">
                    <div className="flex flex-col items-center gap-0.5">
                      {day.isToday ? (
                        <span className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Today</span>
                      ) : (
                        <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">{day.dayName}</span>
                      )}
                      <span className={`text-sm font-bold leading-none ${
                        day.isToday
                          ? "bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs"
                          : "text-gray-700 dark:text-gray-300"
                      }`}>
                        {String(day.dayNum).padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  {/* Timeline bar area */}
                  <div className="flex-1 relative h-12 sm:h-14 min-w-0">
                    {/* Shift window background */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800"
                      style={{
                        left: `${Math.max(0, ((shiftStartMin - timelineStart) / timelineRange) * 100)}%`,
                        width: `${((shiftEndMin - shiftStartMin) / timelineRange) * 100}%`,
                      }}
                    />

                    {/* Weekend / On Leave / Absent indicators */}
                    {day.isWeekend && day.sessions.length === 0 ? (
                      <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex items-center">
                        <div className="flex-1 h-0.5 bg-amber-300/70 dark:bg-amber-600/50 rounded-full" />
                        <span className="mx-3 text-[10px] text-amber-500 dark:text-amber-400 font-medium">Weekend</span>
                        <div className="flex-1 h-0.5 bg-amber-300/70 dark:bg-amber-600/50 rounded-full" />
                      </div>
                    ) : day.status === "ON_LEAVE" && day.sessions.length === 0 ? (
                      <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex items-center">
                        <div className="flex-1 h-0.5 bg-purple-300/70 dark:bg-purple-600/50 rounded-full" />
                        <span className="mx-3 text-[10px] text-purple-500 dark:text-purple-400 font-medium">On Leave</span>
                        <div className="flex-1 h-0.5 bg-purple-300/70 dark:bg-purple-600/50 rounded-full" />
                      </div>
                    ) : (
                      <>
                        {/* Work bars */}
                        {bars.map((bar, bi) => (
                          <div
                            key={bi}
                            className={`absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full ${
                              bar.isActive ? "bg-green-500 dark:bg-green-400" : "bg-green-500/80 dark:bg-green-400/80"
                            }`}
                            style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                          >
                            {bar.isActive && (
                              <div className="absolute inset-0 rounded-full bg-green-400/50 dark:bg-green-300/30 animate-pulse" />
                            )}
                          </div>
                        ))}

                        {/* Check-in dot */}
                        {day.firstCheckIn && (
                          <div
                            className="absolute top-1/2 w-3 h-3 rounded-full bg-green-500 dark:bg-green-400 ring-2 ring-white dark:ring-gray-900 z-[2]"
                            style={{ left: `${((isoToMinutesIST(day.firstCheckIn) - timelineStart) / timelineRange) * 100}%`, transform: "translate(-50%, -50%)" }}
                          />
                        )}

                        {/* Check-out dot */}
                        {day.lastCheckOut && (
                          <div
                            className="absolute top-1/2 w-3 h-3 rounded-full bg-red-500 dark:bg-red-400 ring-2 ring-white dark:ring-gray-900 z-[2]"
                            style={{ left: `${((isoToMinutesIST(day.lastCheckOut) - timelineStart) / timelineRange) * 100}%`, transform: "translate(-50%, -50%)" }}
                          />
                        )}

                        {/* Active now marker */}
                        {day.isToday && isCheckedIn && nowPos >= 0 && nowPos <= 100 && (
                          <div
                            className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-gray-900 z-[3] animate-pulse"
                            style={{ left: `${nowPos}%`, transform: "translate(-50%, -50%)" }}
                          />
                        )}

                        {/* No data for past non-weekend day */}
                        {!day.isWeekend && day.sessions.length === 0 && day.status !== "ON_LEAVE" && (
                          <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4">
                            <div className="h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                          </div>
                        )}
                      </>
                    )}

                    {/* Current time vertical line */}
                    {day.isToday && nowPos >= 0 && nowPos <= 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-400/60 dark:bg-blue-500/60 z-[1]"
                        style={{ left: `${nowPos}%` }}
                      />
                    )}
                  </div>

                  {/* Hours worked */}
                  <div className="w-[72px] sm:w-24 shrink-0 px-2 sm:px-3 py-3 text-right">
                    {day.isToday && liveTimerStr ? (
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">{liveTimerStr}</span>
                        <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500">Hrs</p>
                      </div>
                    ) : day.isWeekend && day.sessions.length === 0 ? (
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-500">00:00</span>
                        <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500">Hrs worked</p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">{formatMinsToHM(day.totalWorkMins)}</span>
                        <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500">Hrs worked</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="bg-gray-50/80 dark:bg-gray-800/30 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {day.status && <Badge variant={statusColor} className="text-[10px]">{day.status.replace("_", " ")}</Badge>}
                      {day.firstCheckIn && <span className="text-xs text-gray-500 dark:text-gray-400">In: <span className="text-green-600 dark:text-green-400 font-medium">{formatTimeFromISO(day.firstCheckIn)}</span></span>}
                      {day.lastCheckOut && <span className="text-xs text-gray-500 dark:text-gray-400">Out: <span className="text-red-600 dark:text-red-400 font-medium">{formatTimeFromISO(day.lastCheckOut)}</span></span>}
                      <span className="text-xs text-gray-500 dark:text-gray-400">Work: <span className="font-medium">{formatMinsToHM(day.totalWorkMins)}</span></span>
                    </div>
                    {day.sessions.length > 0 ? (
                      <div className="space-y-1.5">
                        {day.sessions.map((s) => (
                          <div key={s.id} className="flex items-start gap-2 text-xs">
                            <div className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${s.type === "CHECK_IN" ? "bg-green-500" : "bg-red-500"}`} />
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">{formatTimeFromISO(s.timestamp)}</span>
                              <span className={`ml-1.5 text-[10px] font-medium ${s.type === "CHECK_IN" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                {s.type === "CHECK_IN" ? "IN" : "OUT"}
                              </span>
                              {s.address && <p className="text-gray-400 dark:text-gray-500 truncate max-w-[280px]">📍 {s.address}</p>}
                              {s.note && <p className="text-blue-500 dark:text-blue-400 truncate max-w-[280px]">💬 {s.note}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500">No sessions recorded</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom hour labels */}
        <div className="border-t border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex">
            <div className="w-[72px] sm:w-24 shrink-0" />
            <div className="flex-1 relative h-5 min-w-0">
              {hourMarkers.map((m) => (
                <span key={m.label} className="absolute text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 -translate-x-1/2 top-0.5" style={{ left: `${m.pos}%` }}>{m.label}</span>
              ))}
            </div>
            <div className="w-[72px] sm:w-24 shrink-0" />
          </div>
        </div>
      </Card>
    </div>
  );
}
