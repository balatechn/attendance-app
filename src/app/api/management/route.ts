import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { isManagerOrAbove } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!isManagerOrAbove(role)) {
      return apiError("Forbidden", 403);
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // Run all queries in parallel
    const [
      totalEmployees,
      todaySummaries,
      todayLeaves,
      pendingRegularizations,
      pendingLeaves,
      recentSessions,
      weeklyData,
      departmentStats,
    ] = await Promise.all([
      // Total active employees
      prisma.user.count({ where: { isActive: true } }),

      // Today's daily summaries
      prisma.dailySummary.findMany({
        where: { date: { gte: todayStart, lte: todayEnd } },
        select: { status: true },
      }),

      // Approved leaves for today
      prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
        },
      }),

      // Pending regularizations
      prisma.regularization.count({ where: { status: "PENDING" } }),

      // Pending leave requests
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),

      // Recent check-ins/check-outs (last 10)
      prisma.attendanceSession.findMany({
        where: { timestamp: { gte: todayStart } },
        orderBy: { timestamp: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          timestamp: true,
          user: { select: { name: true, department: { select: { name: true } } } },
        },
      }),

      // Weekly attendance trend (last 7 days)
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const date = subDays(now, 6 - i);
          const dayStart = startOfDay(date);
          const dayEnd = endOfDay(date);
          return prisma.dailySummary
            .count({ where: { date: { gte: dayStart, lte: dayEnd } } })
            .then((count) => ({
              date: format(date, "EEE"),
              fullDate: format(date, "MMM dd"),
              present: count,
            }));
        })
      ),

      // Department-wise stats for today
      prisma.department.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          users: {
            where: { isActive: true },
            select: {
              id: true,
              dailySummaries: {
                where: { date: { gte: todayStart, lte: todayEnd } },
                select: { status: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // Calculate overview stats
    const presentCount = todaySummaries.filter((s) => s.status === "PRESENT" || s.status === "LATE" || s.status === "HALF_DAY").length;
    const lateCount = todaySummaries.filter((s) => s.status === "LATE").length;
    const absentCount = totalEmployees - presentCount - todayLeaves;

    // Process department stats
    const departments = departmentStats.map((dept) => {
      const total = dept.users.length;
      const present = dept.users.filter((u) => u.dailySummaries.length > 0 && ["PRESENT", "LATE", "HALF_DAY"].includes(u.dailySummaries[0].status)).length;
      const late = dept.users.filter((u) => u.dailySummaries.length > 0 && u.dailySummaries[0].status === "LATE").length;
      const onLeave = dept.users.filter((u) => u.dailySummaries.length > 0 && u.dailySummaries[0].status === "ON_LEAVE").length;
      const absent = total - present - onLeave;
      return { id: dept.id, name: dept.name, total, present, absent, late, onLeave };
    });

    // Format recent activity
    const recentActivity = recentSessions.map((s) => ({
      id: s.id,
      type: s.type,
      employeeName: s.user.name,
      department: s.user.department?.name || "—",
      time: format(new Date(s.timestamp), "hh:mm a"),
    }));

    return apiResponse({
      overview: {
        totalEmployees,
        presentToday: presentCount,
        absentToday: absentCount < 0 ? 0 : absentCount,
        onLeaveToday: todayLeaves,
        lateArrivals: lateCount,
        pendingApprovals: pendingRegularizations + pendingLeaves,
      },
      departments,
      recentActivity,
      weeklyTrend: weeklyData,
    });
  } catch (error) {
    console.error("Management dashboard error:", error);
    return apiError("Failed to load management dashboard", 500);
  }
}
