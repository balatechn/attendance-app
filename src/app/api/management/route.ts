import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { isManagerOrAbove } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { startOfDay, endOfDay, subDays, parseISO, eachDayOfInterval } from "date-fns";
import { formatIST } from "@/lib/datetime";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!isManagerOrAbove(role)) {
      return apiError("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const now = new Date();
    const rangeStart = startParam ? startOfDay(parseISO(startParam)) : startOfDay(now);
    const rangeEnd = endParam ? endOfDay(parseISO(endParam)) : endOfDay(now);
    const isToday = !startParam && !endParam;

    // Entity-based visibility
    const isSuperAdmin = role === "SUPER_ADMIN";
    const userEntityId = session.user.entityId;
    const entityFilter: Record<string, unknown> = (!isSuperAdmin && userEntityId) ? { entityId: userEntityId } : {};
    const locationEntityFilter: Record<string, unknown> = (!isSuperAdmin && userEntityId) ? { entityId: userEntityId } : {};
    const userEntityFilter: Record<string, unknown> = { isActive: true, role: { not: "MANAGEMENT" }, ...entityFilter };

    // Run all queries in parallel
    const [
      totalEmployees,
      rangeSummaries,
      rangeLeaves,
      pendingRegularizations,
      pendingLeaves,
      recentSessions,
      locationData,
      departmentData,
      allEmployees,
    ] = await Promise.all([
      // Total active employees
      prisma.user.count({ where: userEntityFilter }),

      // Daily summaries for the date range
      prisma.dailySummary.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd }, user: entityFilter },
        select: { status: true, userId: true, date: true, firstCheckIn: true, lastCheckOut: true, totalWorkMins: true },
      }),

      // Approved leaves overlapping the range
      prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: rangeEnd },
          endDate: { gte: rangeStart },
          user: entityFilter,
        },
      }),

      // Pending regularizations
      prisma.regularization.count({ where: { status: "PENDING", employee: entityFilter } }),

      // Pending leave requests
      prisma.leaveRequest.count({ where: { status: "PENDING", user: entityFilter } }),

      // Recent activity — always from today for live feed
      prisma.attendanceSession.findMany({
        where: { timestamp: { gte: startOfDay(now) }, user: entityFilter },
        orderBy: { timestamp: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          timestamp: true,
          address: true,
          user: { select: { name: true, department: { select: { name: true } }, location: { select: { name: true } } } },
        },
      }),

      // Location-wise with employee details for drilldown
      prisma.location.findMany({
        where: { isActive: true, ...locationEntityFilter },
        select: {
          id: true,
          name: true,
          users: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              role: true,
              employeeCode: true,
              department: { select: { name: true } },
              dailySummaries: {
                where: { date: { gte: rangeStart, lte: rangeEnd } },
                select: { status: true, firstCheckIn: true, lastCheckOut: true, totalWorkMins: true, date: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),

      // Department-wise with employee details for drilldown
      prisma.department.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          users: {
            where: userEntityFilter,
            select: {
              id: true,
              name: true,
              role: true,
              employeeCode: true,
              location: { select: { name: true } },
              dailySummaries: {
                where: { date: { gte: rangeStart, lte: rangeEnd } },
                select: { status: true, firstCheckIn: true, lastCheckOut: true, totalWorkMins: true, date: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),

      // All employees for employee drilldown tab
      prisma.user.findMany({
        where: userEntityFilter,
        select: {
          id: true,
          name: true,
          role: true,
          employeeCode: true,
          department: { select: { name: true } },
          location: { select: { name: true } },
          dailySummaries: {
            where: { date: { gte: rangeStart, lte: rangeEnd } },
            select: { status: true, firstCheckIn: true, lastCheckOut: true, totalWorkMins: true, date: true },
            orderBy: { date: "desc" },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // Calculate overview stats — MANAGEMENT role excluded via userEntityFilter

    // For single-day range, use direct counts. For multi-day, average.
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const numDays = days.length;

    const presentSummaries = rangeSummaries.filter((s) => s.status === "PRESENT" || s.status === "LATE" || s.status === "HALF_DAY");
    const lateSummaries = rangeSummaries.filter((s) => s.status === "LATE");
    const onLeaveSummaries = rangeSummaries.filter((s) => s.status === "ON_LEAVE");

    const presentCount = numDays === 1
      ? presentSummaries.length
      : Math.round(presentSummaries.length / numDays);
    const lateCount = numDays === 1 ? lateSummaries.length : Math.round(lateSummaries.length / numDays);
    const onLeaveCount = numDays === 1 ? rangeLeaves : Math.round(rangeLeaves / numDays);
    const absentCount = Math.max(0, totalEmployees - presentCount - onLeaveCount);

    // Weekly trend (last 7 days from rangeEnd)
    const weeklyTrend = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const date = subDays(rangeEnd, 6 - i);
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
    );

    // Helper: compute status for an employee
    const employeeStatus = (user: { role: string; dailySummaries: { status: string; firstCheckIn: Date | null; lastCheckOut: Date | null; totalWorkMins: number | null; date: Date }[] }) => {
      if (user.dailySummaries.length === 0) return "ABSENT";
      // For single day, use the day's status. For range, pick the most recent or summarize.
      const latest = user.dailySummaries[0];
      return latest.status;
    };

    // Process location stats with employee details
    const locations = locationData.map((loc) => {
      const total = loc.users.length;
      const employees = loc.users.map((u) => {
        const status = employeeStatus(u);
        const latestSummary = u.dailySummaries[0];
        return {
          id: u.id,
          name: u.name,
          employeeCode: u.employeeCode,
          department: u.department?.name || "—",
          role: u.role,
          status,
          checkIn: latestSummary?.firstCheckIn ? formatIST(new Date(latestSummary.firstCheckIn), "hh:mm a") : null,
          checkOut: latestSummary?.lastCheckOut ? formatIST(new Date(latestSummary.lastCheckOut), "hh:mm a") : null,
          workMins: latestSummary?.totalWorkMins || 0,
          presentDays: u.dailySummaries.filter((s) => ["PRESENT", "LATE", "HALF_DAY"].includes(s.status)).length,
          absentDays: numDays - u.dailySummaries.filter((s) => ["PRESENT", "LATE", "HALF_DAY", "ON_LEAVE"].includes(s.status)).length - (u.role === "MANAGEMENT" ? 0 : 0),
        };
      });

      const present = employees.filter((e) => ["PRESENT", "LATE", "HALF_DAY"].includes(e.status)).length;
      const late = employees.filter((e) => e.status === "LATE").length;
      const onLeave = employees.filter((e) => e.status === "ON_LEAVE").length;
      const absent = total - present - onLeave;

      return { id: loc.id, name: loc.name, total, present, absent: Math.max(0, absent), late, onLeave, employees };
    });

    // Process department stats with employee details
    const departments = departmentData.map((dept) => {
      const total = dept.users.length;
      const employees = dept.users.map((u) => {
        const status = employeeStatus(u);
        const latestSummary = u.dailySummaries[0];
        return {
          id: u.id,
          name: u.name,
          employeeCode: u.employeeCode,
          location: u.location?.name || "—",
          role: u.role,
          status,
          checkIn: latestSummary?.firstCheckIn ? formatIST(new Date(latestSummary.firstCheckIn), "hh:mm a") : null,
          checkOut: latestSummary?.lastCheckOut ? formatIST(new Date(latestSummary.lastCheckOut), "hh:mm a") : null,
          workMins: latestSummary?.totalWorkMins || 0,
          presentDays: u.dailySummaries.filter((s) => ["PRESENT", "LATE", "HALF_DAY"].includes(s.status)).length,
        };
      });

      const present = employees.filter((e) => ["PRESENT", "LATE", "HALF_DAY"].includes(e.status)).length;
      const late = employees.filter((e) => e.status === "LATE").length;
      const onLeave = employees.filter((e) => e.status === "ON_LEAVE").length;
      const absent = total - present - onLeave;

      return { id: dept.id, name: dept.name, total, present, absent: Math.max(0, absent), late, onLeave, employees };
    }).filter((d) => d.total > 0);

    // All employees for drilldown tab
    const employees = allEmployees.map((u) => {
      const status = employeeStatus(u);
      const latestSummary = u.dailySummaries[0];
      return {
        id: u.id,
        name: u.name,
        employeeCode: u.employeeCode,
        department: u.department?.name || "—",
        location: u.location?.name || "—",
        role: u.role,
        status,
        checkIn: latestSummary?.firstCheckIn ? formatIST(new Date(latestSummary.firstCheckIn), "hh:mm a") : null,
        checkOut: latestSummary?.lastCheckOut ? formatIST(new Date(latestSummary.lastCheckOut), "hh:mm a") : null,
        workMins: latestSummary?.totalWorkMins || 0,
        presentDays: u.dailySummaries.filter((s) => ["PRESENT", "LATE", "HALF_DAY"].includes(s.status)).length,
        absentDays: numDays - u.dailySummaries.filter((s) => ["PRESENT", "LATE", "HALF_DAY", "ON_LEAVE"].includes(s.status)).length,
        lateDays: u.dailySummaries.filter((s) => s.status === "LATE").length,
        leaveDays: u.dailySummaries.filter((s) => s.status === "ON_LEAVE").length,
      };
    });

    // Format recent activity
    const recentActivity = recentSessions.map((s) => ({
      id: s.id,
      type: s.type,
      employeeName: s.user.name,
      department: s.user.department?.name || "—",
      location: s.user.location?.name || "—",
      time: formatIST(new Date(s.timestamp), "hh:mm a"),
      address: s.address || null,
    }));

    return apiResponse({
      overview: {
        totalEmployees,
        presentToday: presentCount,
        absentToday: absentCount,
        onLeaveToday: onLeaveCount,
        lateArrivals: lateCount,
        pendingApprovals: pendingRegularizations + pendingLeaves,
        halfDay: numDays === 1 ? rangeSummaries.filter((s) => s.status === "HALF_DAY").length : Math.round(rangeSummaries.filter((s) => s.status === "HALF_DAY").length / numDays),
      },
      locations,
      departments,
      employees,
      recentActivity,
      weeklyTrend,
      meta: {
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        numDays,
        isToday,
      },
    });
  } catch (error) {
    console.error("Management dashboard error:", error);
    return apiError("Failed to load management dashboard", 500);
  }
}
