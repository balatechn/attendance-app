import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { AttendancePageClient } from "./attendance-client";
import { startOfDay, endOfDay, addDays, format, getDay } from "date-fns";

export const dynamic = "force-dynamic";

/** Get the Sunday (start of week) for a given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; week?: string }>;
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

  // Determine week range
  const weekParam = params.week ? new Date(params.week + "T00:00:00") : new Date();
  const weekStartDate = getWeekStart(weekParam);
  const weekEndDate = addDays(weekStartDate, 6);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Fetch user shift, sessions for the week, daily summaries, and team members in parallel
  const [targetUser, weeklySessions, weekSummaries, teamMembers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { shift: { select: { name: true, startTime: true, endTime: true } } },
    }),
    prisma.attendanceSession.findMany({
      where: {
        userId: targetUserId,
        timestamp: { gte: startOfDay(weekStartDate), lte: endOfDay(weekEndDate) },
      },
      orderBy: { timestamp: "asc" },
    }),
    prisma.dailySummary.findMany({
      where: {
        userId: targetUserId,
        date: { gte: startOfDay(weekStartDate), lte: endOfDay(weekEndDate) },
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

  // Build 7 day objects
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(weekStartDate, i);
    const dateStr = format(dayDate, "yyyy-MM-dd");
    const dayOfWeek = getDay(dayDate);
    const isToday = dateStr === todayStr;
    const isWeekend = dayOfWeek === 0; // Sunday

    // Get sessions for this day
    const daySessions = weeklySessions.filter((s) => {
      const sDate = format(s.timestamp, "yyyy-MM-dd");
      return sDate === dateStr;
    });

    // Get summary for this day
    const summary = weekSummaries.find((s) => format(s.date, "yyyy-MM-dd") === dateStr);

    return {
      date: dateStr,
      dayName: DAY_NAMES[dayOfWeek],
      dayNum: dayDate.getDate(),
      isToday,
      isWeekend,
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

  const selectedEmployee = targetUserId !== currentUserId
    ? teamMembers.find((e) => e.id === targetUserId)
    : null;

  return (
    <AttendancePageClient
      weekDays={weekDays}
      weekStart={format(weekStartDate, "yyyy-MM-dd")}
      weekEnd={format(weekEndDate, "yyyy-MM-dd")}
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
