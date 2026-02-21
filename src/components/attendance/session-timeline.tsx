"use client";

import { Card, Badge } from "@/components/ui";
import { formatTime } from "@/lib/datetime";

interface Session {
  id: string;
  type: "CHECK_IN" | "CHECK_OUT";
  timestamp: string;
  latitude: number;
  longitude: number;
}

interface SessionTimelineProps {
  sessions: Session[];
}

export function SessionTimeline({ sessions }: SessionTimelineProps) {
  if (sessions.length === 0) {
    return (
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Today&apos;s Timeline
        </h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No sessions yet
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Today&apos;s Timeline
      </h3>
      <div className="space-y-3">
        {sessions.map((session, idx) => (
          <div key={session.id} className="flex items-start gap-3">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  session.type === "CHECK_IN"
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
              />
              {idx < sessions.length - 1 && (
                <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatTime(session.timestamp)}
                </p>
                <Badge
                  variant={
                    session.type === "CHECK_IN"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }
                >
                  {session.type === "CHECK_IN" ? "In" : "Out"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                📍 {session.latitude.toFixed(4)}, {session.longitude.toFixed(4)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
