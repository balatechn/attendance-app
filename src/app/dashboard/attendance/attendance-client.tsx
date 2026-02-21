"use client";

import { SessionTimeline } from "@/components/attendance/session-timeline";
import { Card, Badge } from "@/components/ui";
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
}

export function AttendancePageClient({ sessions, recentDays }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Attendance
      </h2>

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
