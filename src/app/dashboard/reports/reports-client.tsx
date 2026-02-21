"use client";

import { useState } from "react";
import { CalendarView, MonthlyStats } from "@/components/reports/calendar-view";
import { Button, Card } from "@/components/ui";

interface Props {
  calendarData: Array<{
    date: string;
    status: string;
    totalWorkMins: number;
  }>;
  stats: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
    totalWorkHours: number;
    totalOvertimeHours: number;
    totalBreakHours: number;
    workingDays: number;
  };
  initialMonth: string;
}

export function ReportsClient({ calendarData, stats, initialMonth }: Props) {
  const [month, setMonth] = useState(new Date(initialMonth));
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type: "pdf" | "excel") => {
    setExporting(true);
    try {
      const res = await fetch(
        `/api/reports/export?month=${month.toISOString()}&type=${type}`
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance-report-${month.toISOString().slice(0, 7)}.${type === "pdf" ? "pdf" : "xlsx"}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Reports
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={exporting}
            onClick={() => handleExport("excel")}
          >
            📊 Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            loading={exporting}
            onClick={() => handleExport("pdf")}
          >
            📄 PDF
          </Button>
        </div>
      </div>

      <MonthlyStats stats={stats} />
      <CalendarView data={calendarData} month={month} onMonthChange={setMonth} />
    </div>
  );
}
