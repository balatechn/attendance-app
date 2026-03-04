import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { AttendancePageClient } from "./attendance-client";
import { startOfDay, endOfDay, format, getDay } from "date-fns";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const role = session.user.role as Role;
  const currentUserId = session.user.id;
  const canViewTeam = hasPermission(role, "attendance:view-team") || hasPermission(role, "attendance:view-all");

  // Determine target user
  let targetUserId = currentUserId;
  if (params.employee && canViewTeam) {
    if (hasPermission(role, "attendance:view-all")) {
      targetUserId = params.employee;
    } else if (hasPermission(role, "attendance:view-team")) {
      const isDirectReport = await prisma.user.count({
        where: { id: params.employee, managerId: currentUserId },
      });
      if (isDirectReport > 0) targetUserId = params.employee;
    }
  }

  // Determine month range
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  if (params.month) {
    const [y, m] = params.month.split("-").map(Number);
    year = y;
    month = m - 1;
  }
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const todayStr = format(now, "yyyy-MM-dd");
  const daysInMonth = monthEnd.getDate();

  // Fetch shift, sessions, summaries, team members in parallel
  const [targetUser, monthlySessions, monthSummaries, teamMembers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { shift: { select: { name: true, startTime: true, endTime: true } } },
    }),
    prisma.attendanceSession.findMany({
      where: {
        userId: targetUserId,
        timestamp: { gte: startOfDay(monthStart), lte: endOfDay(monthEnd) },
      },
      orderBy: { timestamp: "asc" },
    }),
    prisma.dailySummary.findMany({
      where: {
        userId: targetUserId,
        date: { gte: startOfDay(monthStart), lte: endOfDay(monthEnd) },
      },
    }),
    canViewTeam
      ? (() => {
          const teamWhere: Record<string, unknown> = { isActive: true };
          if (!hasPermission(role, "attendance:view-all")) {
            teamWhere.managerId = currentUserId;
          }
          if (role !== "SUPER_ADMIN" && session.user.entityId) {
            teamWhere.entityId = session.user.entityId;
          }
          return prisma.user.findMany({
            where: teamWhere,
            select: { id: true, name: true, email: true, department: { select: { name: true } } },
            orderBy: { name: "asc" },
          });
        })()
      : Promise.resolve([]),
  ]);

  // Build days array
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayDate = new Date(year, month, i + 1);
    const dateStr = format(dayDate, "yyyy-MM-dd");
    const dayOfWeek = getDay(dayDate);

    const daySessions = monthlySessions.filter(
      (s) => format(s.timestamp, "yyyy-MM-dd") === dateStr
    );
    const summary = monthSummaries.find(
      (s) => format(s.date, "yyyy-MM-dd") === dateStr
    );

    return {
      date: dateStr,
      dayName: DAY_NAMES[dayOfWeek],
      dayNum: i + 1,
      dayOfWeek,
      isToday: dateStr === todayStr,
      isSunday: dayOfWeek === 0,
      status: summary?.status || "",
      firstCheckIn: summary?.firstCheckIn?.toISOString() || null,
      lastCheckOut: summary?.lastCheckOut?.toISOString() || null,
      totalWorkMins: summary?.totalWorkMins || 0,
      sessions: daySessions.map((s) => ({
        id: s.id,
        type: s.type as "CHECK_IN" | "CHECK_OUT",
        timestamp: s.timestamp.toISOString(),
        address: s.address || null,
        note: s.note || null,
      })),
    };
  });

  const firstDayOfWeek = getDay(monthStart);

  const selectedEmployee = targetUserId !== currentUserId
    ? teamMembers.find((e) => e.id === targetUserId)
    : null;

  return (
    <AttendancePageClient
      days={days}
      year={year}
      month={month + 1}
      firstDayOfWeek={firstDayOfWeek}
      monthLabel={monthStart.toLocaleString("en-US", { month: "long", year: "numeric" })}
      shift={targetUser?.shift || null}
      teamMembers={teamMembers.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        department: e.department,
      }))}
      selectedEmployeeId={targetUserId !== currentUserId ? targetUserId : null}
      selectedEmployeeName={selectedEmployee?.name || null}
      canViewTeam={canViewTeam}
    />
  );
}
