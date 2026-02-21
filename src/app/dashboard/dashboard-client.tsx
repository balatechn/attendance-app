"use client";

import { useEffect } from "react";
import { CheckInOutButton } from "@/components/attendance/check-in-button";
import { DailySummaryWidget } from "@/components/attendance/daily-summary";
import { SessionTimeline } from "@/components/attendance/session-timeline";
import { useAttendanceStore } from "@/lib/store";
import { useOfflineSync } from "@/hooks/use-timer";
import { Card } from "@/components/ui";
import type { Role } from "@/generated/prisma/enums";

interface Props {
  user: { name: string; role: Role };
  sessions: Array<{
    id: string;
    type: "CHECK_IN" | "CHECK_OUT";
    timestamp: string;
    latitude: number;
    longitude: number;
  }>;
  summary: {
    firstCheckIn: string | null;
    lastCheckOut: string | null;
    totalWorkMins: number;
    totalBreakMins: number;
    overtimeMins: number;
    sessionCount: number;
    status: string;
  } | null;
  isCheckedIn: boolean;
  lastCheckInTime: string | null;
}

export function DashboardClient({
  user,
  sessions,
  summary,
  isCheckedIn,
  lastCheckInTime,
}: Props) {
  const store = useAttendanceStore();
  const { pendingCount } = useOfflineSync();

  // Sync server state to client store on mount
  useEffect(() => {
    if (isCheckedIn && lastCheckInTime) {
      if (!store.isCheckedIn) {
        store.checkIn(0, 0); // Will be overwritten by actual location
        // Update session start time from server
        useAttendanceStore.setState({ currentSessionStart: lastCheckInTime });
      }
    } else if (!isCheckedIn && store.isCheckedIn) {
      store.checkOut();
    }
  }, [isCheckedIn, lastCheckInTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Good Morning"
      : now.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {greeting}, {user.name.split(" ")[0]}! 👋
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Offline queue indicator */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-sm px-4 py-2 rounded-lg">
          ⚡ {pendingCount} action(s) queued offline. Will sync when connected.
        </div>
      )}

      {/* Check In/Out section */}
      <Card className="flex flex-col items-center py-8">
        <CheckInOutButton />
      </Card>

      {/* Today's summary */}
      <DailySummaryWidget summary={summary} />

      {/* Session timeline */}
      <SessionTimeline sessions={sessions} />
    </div>
  );
}
