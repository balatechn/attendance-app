"use client";

import { useState, useMemo } from "react";
import { Card, Badge } from "@/components/ui";
import { STATUS_COLORS } from "@/lib/constants";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  getDay,
  isToday,
} from "date-fns";

interface CalendarDay {
  date: string; // YYYY-MM-DD
  status: string;
  totalWorkMins: number;
}

interface CalendarViewProps {
  data: CalendarDay[];
  month: Date;
  onMonthChange: (date: Date) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ data, month, onMonthChange }: CalendarViewProps) {
  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const firstDayOffset = getDay(days[0]);

  const dataMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    data.forEach((d) => map.set(d.date, d));
    return map;
  }, [data]);

  const prevMonth = () => {
    const d = new Date(month);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
  };

  const nextMonth = () => {
    const d = new Date(month);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
  };

  return (
    <Card>
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {format(month, "MMMM yyyy")}
        </h3>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for offset */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayData = dataMap.get(dateStr);
          const today = isToday(day);

          return (
            <div
              key={dateStr}
              className={`
                relative flex flex-col items-center justify-center h-10 rounded-lg text-xs
                ${today ? "ring-2 ring-blue-500" : ""}
                ${dayData ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : ""}
              `}
            >
              <span
                className={`
                  font-medium
                  ${today ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}
                `}
              >
                {format(day, "d")}
              </span>
              {dayData && (
                <span
                  className={`
                    w-1.5 h-1.5 rounded-full mt-0.5
                    ${dayData.status === "PRESENT" ? "bg-green-500" : ""}
                    ${dayData.status === "ABSENT" ? "bg-red-500" : ""}
                    ${dayData.status === "LATE" ? "bg-yellow-500" : ""}
                    ${dayData.status === "HALF_DAY" ? "bg-orange-500" : ""}
                    ${dayData.status === "ON_LEAVE" ? "bg-purple-500" : ""}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-gray-800">
        {["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"].map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <span
              className={`
                w-2 h-2 rounded-full
                ${status === "PRESENT" ? "bg-green-500" : ""}
                ${status === "ABSENT" ? "bg-red-500" : ""}
                ${status === "LATE" ? "bg-yellow-500" : ""}
                ${status === "HALF_DAY" ? "bg-orange-500" : ""}
                ${status === "ON_LEAVE" ? "bg-purple-500" : ""}
              `}
            />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {status.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Monthly Stats ────────────────────────────────────────

interface MonthlyStatsProps {
  stats: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
    totalWorkHours: number;
    totalOvertimeHours: number;
    totalBreakHours: number;
    workingDays: number;
  };
}

export function MonthlyStats({ stats }: MonthlyStatsProps) {
  const statItems = [
    { label: "Present Days", value: stats.presentDays, color: "text-green-600 dark:text-green-400" },
    { label: "Absent Days", value: stats.absentDays, color: "text-red-600 dark:text-red-400" },
    { label: "Late Arrivals", value: stats.lateDays, color: "text-yellow-600 dark:text-yellow-400" },
    { label: "Work Hours", value: `${stats.totalWorkHours.toFixed(1)}h`, color: "text-blue-600 dark:text-blue-400" },
    { label: "Overtime", value: `${stats.totalOvertimeHours.toFixed(1)}h`, color: "text-orange-600 dark:text-orange-400" },
    { label: "Break Time", value: `${stats.totalBreakHours.toFixed(1)}h`, color: "text-purple-600 dark:text-purple-400" },
  ];

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Monthly Statistics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {statItems.map((item) => (
          <div key={item.label}>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
