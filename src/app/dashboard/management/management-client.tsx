"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────
interface OverviewData {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  lateArrivals: number;
  pendingApprovals: number;
}

interface EntityStat {
  id: string;
  name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
}

interface RecentActivity {
  id: string;
  type: "CHECK_IN" | "CHECK_OUT";
  employeeName: string;
  department: string;
  time: string;
  address?: string | null;
}

interface WeeklyTrend {
  date: string;
  fullDate: string;
  present: number;
}

interface DashboardData {
  overview: OverviewData;
  entities: EntityStat[];
  recentActivity: RecentActivity[];
  weeklyTrend: WeeklyTrend[];
}

// ─── Overview Card ────────────────────────────────────────
function OverviewCard({
  label,
  value,
  icon,
  color,
  subtext,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  subtext?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {subtext}
            </p>
          )}
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-xl",
            color
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Donut Chart (pure CSS) ───────────────────────────────
function AttendanceDonut({ overview }: { overview: OverviewData }) {
  const total = overview.totalEmployees || 1;
  const presentPct = Math.round((overview.presentToday / total) * 100);
  const absentPct = Math.round((overview.absentToday / total) * 100);
  const leavePct = Math.round((overview.onLeaveToday / total) * 100);
  const latePct = Math.round((overview.lateArrivals / total) * 100);

  const segments = [
    { label: "Present", pct: presentPct, color: "bg-green-500" },
    { label: "Absent", pct: absentPct, color: "bg-red-500" },
    { label: "On Leave", pct: leavePct, color: "bg-purple-500" },
    { label: "Late", pct: latePct, color: "bg-yellow-500" },
  ];

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Today&apos;s Attendance Breakdown
      </h3>
      <div className="flex items-center gap-6">
        {/* Circle visualization */}
        <div
          className="w-32 h-32 rounded-full flex-shrink-0 relative"
          style={{
            background: `conic-gradient(
              #22c55e ${presentPct}%,
              #ef4444 ${presentPct}% ${presentPct + absentPct}%,
              #a855f7 ${presentPct + absentPct}% ${presentPct + absentPct + leavePct}%,
              #eab308 ${presentPct + absentPct + leavePct}% 100%
            )`,
          }}
        >
          <div className="absolute inset-3 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {presentPct}%
              </p>
              <p className="text-[10px] text-gray-500">Present</p>
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", s.color)} />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {s.label}
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">
                {s.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Weekly Trend Bar Chart ───────────────────────────────
function WeeklyTrendChart({ data, maxEmployees }: { data: WeeklyTrend[]; maxEmployees: number }) {
  const maxVal = Math.max(...data.map((d) => d.present), 1);

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Weekly Attendance Trend
      </h3>
      <div className="flex items-end justify-between gap-2 h-40">
        {data.map((day) => {
          const heightPct = (day.present / maxVal) * 100;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <span className="text-[10px] font-medium text-gray-900 dark:text-white">
                {day.present}
              </span>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-t-lg relative" style={{ height: "100%" }}>
                <div
                  className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg transition-all duration-500"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {day.date}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-2 text-right">
        of {maxEmployees} employees
      </p>
    </Card>
  );
}

// ─── Department Table ─────────────────────────────────────
function EntityTable({ entities }: { entities: EntityStat[] }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Entity-wise Summary
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                Entity
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                Total
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                Present
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                Absent
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                Late
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                On Leave
              </th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr
                key={entity.id}
                className="border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">
                  {entity.name}
                </td>
                <td className="py-2.5 px-3 text-center text-gray-600 dark:text-gray-400">
                  {entity.total}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {entity.present}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {entity.absent}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                    {entity.late}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    {entity.onLeave}
                  </span>
                </td>
              </tr>
            ))}
            {entities.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  No entities found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Recent Activity Feed ─────────────────────────────────
function RecentActivityFeed({ activities }: { activities: RecentActivity[] }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Recent Activity
      </h3>
      <div className="space-y-3">
        {activities.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0",
                a.type === "CHECK_IN"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                  : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              )}
            >
              {a.type === "CHECK_IN" ? "↓" : "↑"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {a.employeeName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {a.department}
              </p>
              {a.address && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5" title={a.address}>
                  📍 {a.address}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <Badge
                variant={a.type === "CHECK_IN" ? "success" : "danger"}
              >
                {a.type === "CHECK_IN" ? "In" : "Out"}
              </Badge>
              <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">
            No activity today yet
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────
export function ManagementDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/management");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || "Failed to load data");
      }
    } catch {
      setError("Failed to load management dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Management Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Management Dashboard
        </h2>
        <Card>
          <div className="py-8 text-center">
            <p className="text-red-500">{error || "No data available"}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const { overview, entities, recentActivity, weeklyTrend } = data;
  const presentPct = overview.totalEmployees
    ? Math.round((overview.presentToday / overview.totalEmployees) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Management Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <OverviewCard
          label="Total Staff"
          value={overview.totalEmployees}
          icon="👥"
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <OverviewCard
          label="Present"
          value={overview.presentToday}
          icon="✅"
          color="bg-green-100 dark:bg-green-900/30"
          subtext={`${presentPct}%`}
        />
        <OverviewCard
          label="Absent"
          value={overview.absentToday}
          icon="❌"
          color="bg-red-100 dark:bg-red-900/30"
        />
        <OverviewCard
          label="On Leave"
          value={overview.onLeaveToday}
          icon="🏖️"
          color="bg-purple-100 dark:bg-purple-900/30"
        />
        <OverviewCard
          label="Late"
          value={overview.lateArrivals}
          icon="⏰"
          color="bg-yellow-100 dark:bg-yellow-900/30"
        />
        <OverviewCard
          label="Pending"
          value={overview.pendingApprovals}
          icon="📋"
          color="bg-orange-100 dark:bg-orange-900/30"
          subtext="Approvals"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttendanceDonut overview={overview} />
        <WeeklyTrendChart data={weeklyTrend} maxEmployees={overview.totalEmployees} />
      </div>

      {/* Entity Table */}
      <EntityTable entities={entities} />

      {/* Recent Activity */}
      <RecentActivityFeed activities={recentActivity} />
    </div>
  );
}
