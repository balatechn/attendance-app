"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // Sync server state to client store on mount AND on every server refresh
  // Always overwrite store with authoritative server data to prevent stale timers
  useEffect(() => {
    if (isCheckedIn && lastCheckInTime) {
      // Always force-set session start from server — prevents stale localStorage timer
      useAttendanceStore.setState({
        isCheckedIn: true,
        currentSessionStart: lastCheckInTime,
      });
    } else if (!isCheckedIn) {
      // Server says not checked in — force store to match
      if (store.isCheckedIn) {
        store.checkOut();
      }
    }
  }, [isCheckedIn, lastCheckInTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh dashboard data every 30 seconds to stay in sync across devices
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  // Callback for CheckInOutButton to trigger an immediate refresh
  const onSessionChange = useCallback(() => {
    // Small delay to let the server process the session
    setTimeout(() => router.refresh(), 1000);
  }, [router]);

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
        <CheckInOutButton onSessionChange={onSessionChange} />
      </Card>

      {/* Today's summary */}
      <DailySummaryWidget summary={summary} />

      {/* Session timeline */}
      <SessionTimeline sessions={sessions} />
    </div>
  );
}
