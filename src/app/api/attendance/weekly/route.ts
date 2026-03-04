import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { startOfDay, endOfDay, addDays, format, getDay } from "date-fns";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get("week");
    const employeeId = searchParams.get("employee");

    const role = session.user.role as Role;
    const currentUserId = session.user.id;

    // Determine target user
    let targetUserId = currentUserId;
    if (employeeId) {
      const canViewAll = hasPermission(role, "attendance:view-all");
      const canViewTeam = hasPermission(role, "attendance:view-team");
      if (canViewAll) {
        targetUserId = employeeId;
      } else if (canViewTeam) {
        const isReport = await prisma.user.count({
          where: { id: employeeId, managerId: currentUserId },
        });
        if (isReport > 0) targetUserId = employeeId;
      }
    }

    // Week range
    const weekDate = weekParam ? new Date(weekParam + "T00:00:00") : new Date();
    const weekStartDate = getWeekStart(weekDate);
    const weekEndDate = addDays(weekStartDate, 6);
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Parallel fetch: sessions + summaries
    const [weeklySessions, weekSummaries] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: {
          userId: targetUserId,
          timestamp: { gte: startOfDay(weekStartDate), lte: endOfDay(weekEndDate) },
        },
        select: {
          id: true,
          type: true,
          timestamp: true,
          address: true,
          note: true,
        },
        orderBy: { timestamp: "asc" },
      }),
      prisma.dailySummary.findMany({
        where: {
          userId: targetUserId,
          date: { gte: startOfDay(weekStartDate), lte: endOfDay(weekEndDate) },
        },
        select: {
          date: true,
          status: true,
          firstCheckIn: true,
          lastCheckOut: true,
          totalWorkMins: true,
        },
      }),
    ]);

    // Build 7 days
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const dayDate = addDays(weekStartDate, i);
      const dateStr = format(dayDate, "yyyy-MM-dd");
      const dayOfWeek = getDay(dayDate);

      const daySessions = weeklySessions.filter(
        (s) => format(s.timestamp, "yyyy-MM-dd") === dateStr
      );
      const summary = weekSummaries.find(
        (s) => format(s.date, "yyyy-MM-dd") === dateStr
      );

      return {
        date: dateStr,
        dayName: DAY_NAMES[dayOfWeek],
        dayNum: dayDate.getDate(),
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0,
        status: summary?.status || "",
        firstCheckIn: summary?.firstCheckIn?.toISOString() || null,
        lastCheckOut: summary?.lastCheckOut?.toISOString() || null,
        totalWorkMins: summary?.totalWorkMins || 0,
        sessions: daySessions.map((s) => ({
          id: s.id,
          type: s.type,
          timestamp: s.timestamp.toISOString(),
          address: s.address || null,
          note: s.note || null,
        })),
      };
    });

    return apiResponse({
      weekDays,
      weekStart: format(weekStartDate, "yyyy-MM-dd"),
      weekEnd: format(weekEndDate, "yyyy-MM-dd"),
    });
  } catch (error) {
    console.error("Weekly attendance error:", error);
    return apiError("Internal server error", 500);
  }
}
