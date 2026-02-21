"use client";

import { Card, Badge } from "@/components/ui";
import { minutesToHoursMinutes } from "@/lib/datetime";
import { STATUS_COLORS } from "@/lib/constants";

interface DailySummaryProps {
  summary: {
    firstCheckIn: string | null;
    lastCheckOut: string | null;
    totalWorkMins: number;
    totalBreakMins: number;
    overtimeMins: number;
    sessionCount: number;
    status: string;
  } | null;
}

export function DailySummaryWidget({ summary }: DailySummaryProps) {
  if (!summary) {
    return (
      <Card>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
          Today&apos;s Summary
        </h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No attendance recorded today
        </p>
      </Card>
    );
  }

  const stats = [
    {
      label: "First In",
      value: summary.firstCheckIn
        ? new Date(summary.firstCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "--:--",
      icon: "🟢",
    },
    {
      label: "Last Out",
      value: summary.lastCheckOut
        ? new Date(summary.lastCheckOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "--:--",
      icon: "🔴",
    },
    {
      label: "Work Hours",
      value: minutesToHoursMinutes(summary.totalWorkMins),
      icon: "⏱️",
    },
    {
      label: "Break Time",
      value: minutesToHoursMinutes(summary.totalBreakMins),
      icon: "☕",
    },
    {
      label: "Overtime",
      value: minutesToHoursMinutes(summary.overtimeMins),
      icon: "🔥",
    },
    {
      label: "Sessions",
      value: summary.sessionCount.toString(),
      icon: "📊",
    },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Today&apos;s Summary
        </h3>
        <Badge variant={STATUS_COLORS[summary.status]}>
          {summary.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-lg mb-0.5">{stat.icon}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {stat.value}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
