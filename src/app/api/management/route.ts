import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { isManagerOrAbove } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { formatIST } from "@/lib/datetime";

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

    // Entity-based visibility: only SUPER_ADMIN sees all entities
    const isSuperAdmin = role === "SUPER_ADMIN";
    const userEntityId = session.user.entityId;
    const entityFilter: Record<string, unknown> = (!isSuperAdmin && userEntityId) ? { entityId: userEntityId } : {};
    const userEntityFilter: Record<string, unknown> = { isActive: true, ...entityFilter };

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
      prisma.user.count({ where: userEntityFilter }),

      // Today's daily summaries
      prisma.dailySummary.findMany({
        where: { date: { gte: todayStart, lte: todayEnd }, user: entityFilter },
        select: { status: true },
      }),

      // Approved leaves for today
      prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
          user: entityFilter,
        },
      }),

      // Pending regularizations
      prisma.regularization.count({ where: { status: "PENDING", employee: entityFilter } }),

      // Pending leave requests
      prisma.leaveRequest.count({ where: { status: "PENDING", user: entityFilter } }),

      // Recent check-ins/check-outs (last 10)
      prisma.attendanceSession.findMany({
        where: { timestamp: { gte: todayStart }, user: entityFilter },
        orderBy: { timestamp: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          timestamp: true,
          address: true,
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
            .count({ where: { date: { gte: dayStart, lte: dayEnd }, user: entityFilter } })
            .then((count) => ({
              date: formatIST(date, "EEE"),
              fullDate: formatIST(date, "MMM dd"),
              present: count,
            }));
        })
      ),

      // Location-wise stats for today
      prisma.location.findMany({
        where: { isActive: true, ...( (!isSuperAdmin && userEntityId) ? { entityId: userEntityId } : {}) },
        select: {
          id: true,
          name: true,
          users: {
            where: { isActive: true },
            select: {
              id: true,
              role: true,
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
    const managementCount = await prisma.user.count({ where: { ...userEntityFilter, role: "MANAGEMENT" } });
    const presentCount = todaySummaries.filter((s) => s.status === "PRESENT" || s.status === "LATE" || s.status === "HALF_DAY").length + managementCount;
    const lateCount = todaySummaries.filter((s) => s.status === "LATE").length;
    const absentCount = totalEmployees - presentCount - todayLeaves;

    // Process location stats
    const locations = departmentStats.map((loc) => {
      const total = loc.users.length;
      const present = loc.users.filter((u) => u.role === "MANAGEMENT" || (u.dailySummaries.length > 0 && ["PRESENT", "LATE", "HALF_DAY"].includes(u.dailySummaries[0].status))).length;
      const late = loc.users.filter((u) => u.role !== "MANAGEMENT" && u.dailySummaries.length > 0 && u.dailySummaries[0].status === "LATE").length;
      const onLeave = loc.users.filter((u) => u.role !== "MANAGEMENT" && u.dailySummaries.length > 0 && u.dailySummaries[0].status === "ON_LEAVE").length;
      const absent = total - present - onLeave;
      return { id: loc.id, name: loc.name, total, present, absent, late, onLeave };
    });

    // Format recent activity
    const recentActivity = recentSessions.map((s) => ({
      id: s.id,
      type: s.type,
      employeeName: s.user.name,
      department: s.user.department?.name || "—",
      time: formatIST(new Date(s.timestamp), "hh:mm a"),
      address: s.address || null,
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
      locations,
      recentActivity,
      weeklyTrend: weeklyData,
    });
  } catch (error) {
    console.error("Management dashboard error:", error);
    return apiError("Failed to load management dashboard", 500);
  }
}
