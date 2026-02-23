"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SessionTimeline } from "@/components/attendance/session-timeline";
import { Card, Badge, Button, Input } from "@/components/ui";
import { formatDate, formatTime, minutesToHoursMinutes } from "@/lib/datetime";
import { STATUS_COLORS } from "@/lib/constants";

interface Props {
  sessions: Array<{
    id: string;
    type: "CHECK_IN" | "CHECK_OUT";
    timestamp: string;
    latitude: number;
    longitude: number;
  }>;
  recentDays: Array<{
    date: string;
    status: string;
    totalWorkMins: number;
    firstCheckIn: string | null;
    lastCheckOut: string | null;
  }>;
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    department: { name: string } | null;
  }>;
  selectedEmployeeId: string | null;
  selectedEmployeeName: string | null;
  canViewTeam: boolean;
}

export function AttendancePageClient({ sessions, recentDays, teamMembers, selectedEmployeeId, selectedEmployeeName, canViewTeam }: Props) {
  const router = useRouter();
  const [showRegForm, setShowRegForm] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState("");
  const [regError, setRegError] = useState("");
  const [regForm, setRegForm] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "MISSED_CHECK_IN",
    reason: "",
  });

  const handleRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");
    setRegLoading(true);

    try {
      const res = await fetch("/api/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!data.success) {
        setRegError(data.error?.message || "Failed to submit request");
        return;
      }
      setRegSuccess("Regularization request submitted! Your manager has been notified via email.");
      setRegForm({ date: new Date().toISOString().split("T")[0], type: "MISSED_CHECK_IN", reason: "" });
      setTimeout(() => {
        setShowRegForm(false);
        setRegSuccess("");
      }, 3000);
    } catch {
      setRegError("Something went wrong");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Attendance
          </h2>
          {selectedEmployeeName && (
            <Badge variant="info" className="text-xs">
              Viewing: {selectedEmployeeName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canViewTeam && (
            <select
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-w-[200px]"
              value={selectedEmployeeId || ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  router.push(`/dashboard/attendance?employee=${val}`);
                } else {
                  router.push("/dashboard/attendance");
                }
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
              {showRegForm ? (
                "Cancel"
              ) : (
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
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Request Attendance Regularization
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Submit a request to your reporting manager for attendance correction. They will be notified via email.
          </p>

          <form onSubmit={handleRegSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Date"
                type="date"
                value={regForm.date}
                onChange={(e) => setRegForm({ ...regForm, date: e.target.value })}
                required
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={regForm.type}
                  onChange={(e) => setRegForm({ ...regForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="MISSED_CHECK_IN">Missed Check-In</option>
                  <option value="MISSED_CHECK_OUT">Missed Check-Out</option>
                  <option value="WRONG_TIME">Wrong Time Recorded</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
              <textarea
                value={regForm.reason}
                onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                rows={3}
                required
                placeholder="Please explain the reason for this regularization request..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 resize-none"
              />
            </div>

            {regError && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                {regError}
              </div>
            )}
            {regSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm px-3 py-2 rounded-lg">
                {regSuccess}
              </div>
            )}

            <Button type="submit" loading={regLoading} size="sm">
              Submit Regularization Request
            </Button>
          </form>
        </Card>
      )}

      {/* Today's sessions */}
      <SessionTimeline sessions={sessions} />

      {/* Recent days */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Recent Days
        </h3>
        <div className="space-y-2">
          {recentDays.length === 0 ? (
            <p className="text-sm text-gray-400">No recent records</p>
          ) : (
            recentDays.map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(day.date)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {day.firstCheckIn ? formatTime(day.firstCheckIn) : "--"} →{" "}
                    {day.lastCheckOut ? formatTime(day.lastCheckOut) : "--"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {minutesToHoursMinutes(day.totalWorkMins)}
                  </span>
                  <Badge variant={STATUS_COLORS[day.status]}>
                    {day.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
