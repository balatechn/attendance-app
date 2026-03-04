import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { startOfDay, endOfDay, format, getDay } from "date-fns";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // yyyy-MM
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

    // Month range
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed
    if (monthParam) {
      const [y, m] = monthParam.split("-").map(Number);
      year = y;
      month = m - 1;
    }
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0); // last day of month
    const todayStr = format(now, "yyyy-MM-dd");
    const daysInMonth = monthEnd.getDate();

    // Parallel fetch
    const [monthlySessions, monthSummaries] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: {
          userId: targetUserId,
          timestamp: { gte: startOfDay(monthStart), lte: endOfDay(monthEnd) },
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
          date: { gte: startOfDay(monthStart), lte: endOfDay(monthEnd) },
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
          type: s.type,
          timestamp: s.timestamp.toISOString(),
          address: s.address || null,
          note: s.note || null,
        })),
      };
    });

    // First day offset (for calendar grid padding)
    const firstDayOfWeek = getDay(monthStart);

    return apiResponse({
      days,
      year,
      month: month + 1,
      firstDayOfWeek,
      monthLabel: monthStart.toLocaleString("en-US", { month: "long", year: "numeric" }),
    });
  } catch (error) {
    console.error("Monthly attendance error:", error);
    return apiError("Internal server error", 500);
  }
}
