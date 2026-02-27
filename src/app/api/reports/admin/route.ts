import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { formatIST } from "@/lib/datetime";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "reports:view-all")) {
      return apiError("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") || "attendance-summary";
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const departmentId = searchParams.get("department") || "";
    const entityId = searchParams.get("entity") || "";
    const locationId = searchParams.get("location") || "";
    const exportFormat = searchParams.get("export"); // "excel" or null

    if (!startDate || !endDate) {
      return apiError("Start and end dates are required", 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    // Set end to end of day
    end.setHours(23, 59, 59, 999);

    const userWhere: Record<string, unknown> = { isActive: true };
    if (departmentId) userWhere.departmentId = departmentId;
    if (entityId) userWhere.entityId = entityId;
    if (locationId) userWhere.locationId = locationId;

    // Entity-based visibility: only SUPER_ADMIN sees all entities
    if (role !== "SUPER_ADMIN" && session.user.entityId) {
      // Force entity filter — override any entity selection to user's own entity
      if (!entityId) userWhere.entityId = session.user.entityId;
    }

    switch (reportType) {
      case "attendance-summary":
        return await attendanceSummaryReport(start, end, userWhere, exportFormat);
      case "daily-attendance":
        return await dailyAttendanceReport(start, userWhere, exportFormat);
      case "late-arrivals":
        return await lateArrivalsReport(start, end, userWhere, exportFormat);
      case "overtime":
        return await overtimeReport(start, end, userWhere, exportFormat);
      case "leave-summary":
        return await leaveSummaryReport(start, end, userWhere, exportFormat);
      default:
        return apiError("Invalid report type", 400);
    }
  } catch (error) {
    console.error("Admin report error:", error);
    return apiError("Failed to generate report", 500);
  }
}

// ─── Report 1: Attendance Summary ─────────────────────────
async function attendanceSummaryReport(
  start: Date,
  end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      employeeCode: true,
      department: { select: { name: true } },
      dailySummaries: {
        where: { date: { gte: start, lte: end } },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = users.map((u) => {
    const summaries = u.dailySummaries;
    const presentDays = summaries.filter(
      (s) => s.status === "PRESENT" || s.status === "LATE"
    ).length;
    const absentDays = summaries.filter((s) => s.status === "ABSENT").length;
    const lateDays = summaries.filter((s) => s.status === "LATE").length;
    const halfDays = summaries.filter((s) => s.status === "HALF_DAY").length;
    const onLeaveDays = summaries.filter((s) => s.status === "ON_LEAVE").length;
    const totalWorkMins = summaries.reduce((a, s) => a + s.totalWorkMins, 0);
    const totalOTMins = summaries.reduce((a, s) => a + s.overtimeMins, 0);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      employeeCode: u.employeeCode || "-",
      department: u.department?.name || "-",
      totalDays: summaries.length,
      presentDays,
      absentDays,
      lateDays,
      halfDays,
      onLeaveDays,
      totalWorkHours: +(totalWorkMins / 60).toFixed(1),
      avgDailyHours: summaries.length > 0 ? +(totalWorkMins / 60 / summaries.length).toFixed(1) : 0,
      totalOTHours: +(totalOTMins / 60).toFixed(1),
    };
  });

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode,
        "Employee Name": d.name,
        Department: d.department,
        "Total Days": d.totalDays,
        "Present Days": d.presentDays,
        "Absent Days": d.absentDays,
        "Late Days": d.lateDays,
        "Half Days": d.halfDays,
        "On Leave": d.onLeaveDays,
        "Total Work Hours": d.totalWorkHours,
        "Avg Daily Hours": d.avgDailyHours,
        "Overtime Hours": d.totalOTHours,
      })),
      "Attendance Summary",
      `attendance-summary-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`
    );
  }

  return apiResponse(data);
}

// ─── Report 2: Daily Attendance ───────────────────────────
async function dailyAttendanceReport(
  date: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      employeeCode: true,
      department: { select: { name: true } },
      dailySummaries: {
        where: { date: { gte: dayStart, lte: dayEnd } },
        take: 1,
      },
      sessions: {
        where: { timestamp: { gte: dayStart, lte: dayEnd } },
        orderBy: { timestamp: "asc" },
        select: { type: true, address: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = users.map((u) => {
    const summary = u.dailySummaries[0];
    const sessions = u.sessions || [];
    const firstCheckInSession = sessions.find((s) => s.type === "CHECK_IN");
    const checkOuts = sessions.filter((s) => s.type === "CHECK_OUT");
    const lastCheckOutSession = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1] : null;

    return {
      id: u.id,
      name: u.name,
      employeeCode: u.employeeCode || "-",
      department: u.department?.name || "-",
      status: summary?.status || "ABSENT",
      firstCheckIn: summary?.firstCheckIn
        ? formatIST(summary.firstCheckIn, "HH:mm")
        : "-",
      lastCheckOut: summary?.lastCheckOut
        ? formatIST(summary.lastCheckOut, "HH:mm")
        : "-",
      checkInLocation: firstCheckInSession?.address || "-",
      checkOutLocation: lastCheckOutSession?.address || "-",
      workHours: summary ? +(summary.totalWorkMins / 60).toFixed(1) : 0,
      breakHours: summary ? +(summary.totalBreakMins / 60).toFixed(1) : 0,
      sessions: summary?.sessionCount || 0,
      isLate: summary?.status === "LATE",
    };
  });

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode,
        "Employee Name": d.name,
        Department: d.department,
        Status: d.status,
        "Check-In": d.firstCheckIn,
        "Check-In Location": d.checkInLocation,
        "Check-Out": d.lastCheckOut,
        "Check-Out Location": d.checkOutLocation,
        "Work Hours": d.workHours,
        "Break Hours": d.breakHours,
        Sessions: d.sessions,
      })),
      "Daily Attendance",
      `daily-attendance-${formatIST(date, "yyyy-MM-dd")}`
    );
  }

  return apiResponse(data);
}

// ─── Report 3: Late Arrivals ──────────────────────────────
async function lateArrivalsReport(
  start: Date,
  end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      employeeCode: true,
      department: { select: { name: true } },
      shift: { select: { name: true, startTime: true } },
      dailySummaries: {
        where: {
          date: { gte: start, lte: end },
          status: "LATE",
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Flatten: one row per late day per employee
  const flatData: Array<{
    id: string;
    name: string;
    employeeCode: string;
    department: string;
    shift: string;
    date: string;
    checkIn: string;
    lateDays?: number;
  }> = [];

  const summaryData: Array<{
    id: string;
    name: string;
    employeeCode: string;
    department: string;
    shift: string;
    lateDays: number;
    dates: Array<{ date: string; checkIn: string }>;
  }> = [];

  for (const u of users) {
    if (u.dailySummaries.length === 0) continue;

    const dates = u.dailySummaries.map((s) => ({
      date: formatIST(s.date, "yyyy-MM-dd"),
      checkIn: s.firstCheckIn ? formatIST(s.firstCheckIn, "HH:mm") : "-",
    }));

    summaryData.push({
      id: u.id,
      name: u.name,
      employeeCode: u.employeeCode || "-",
      department: u.department?.name || "-",
      shift: u.shift ? `${u.shift.name} (${u.shift.startTime})` : "General",
      lateDays: u.dailySummaries.length,
      dates,
    });

    for (const s of u.dailySummaries) {
      flatData.push({
        id: u.id,
        name: u.name,
        employeeCode: u.employeeCode || "-",
        department: u.department?.name || "-",
        shift: u.shift ? `${u.shift.name} (${u.shift.startTime})` : "General",
        date: formatIST(s.date, "yyyy-MM-dd"),
        checkIn: s.firstCheckIn ? formatIST(s.firstCheckIn, "HH:mm") : "-",
      });
    }
  }

  if (exportFormat === "excel") {
    return await exportToExcel(
      flatData.map((d) => ({
        "Employee Code": d.employeeCode,
        "Employee Name": d.name,
        Department: d.department,
        Shift: d.shift,
        Date: d.date,
        "Check-In Time": d.checkIn,
      })),
      "Late Arrivals",
      `late-arrivals-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`
    );
  }

  // Sort by most late days
  summaryData.sort((a, b) => b.lateDays - a.lateDays);
  return apiResponse(summaryData);
}

// ─── Report 4: Overtime Report ────────────────────────────
async function overtimeReport(
  start: Date,
  end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      employeeCode: true,
      department: { select: { name: true } },
      dailySummaries: {
        where: {
          date: { gte: start, lte: end },
          overtimeMins: { gt: 0 },
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = users
    .filter((u) => u.dailySummaries.length > 0)
    .map((u) => {
      const totalOTMins = u.dailySummaries.reduce(
        (a, s) => a + s.overtimeMins,
        0
      );
      return {
        id: u.id,
        name: u.name,
        employeeCode: u.employeeCode || "-",
        department: u.department?.name || "-",
        otDays: u.dailySummaries.length,
        totalOTHours: +(totalOTMins / 60).toFixed(1),
        avgOTPerDay: +(totalOTMins / 60 / u.dailySummaries.length).toFixed(1),
        dates: u.dailySummaries.map((s) => ({
          date: formatIST(s.date, "yyyy-MM-dd"),
          otHours: +(s.overtimeMins / 60).toFixed(1),
        })),
      };
    })
    .sort((a, b) => b.totalOTHours - a.totalOTHours);

  if (exportFormat === "excel") {
    // Flatten for excel
    const rows: Array<Record<string, unknown>> = [];
    for (const d of data) {
      for (const dt of d.dates) {
        rows.push({
          "Employee Code": d.employeeCode,
          "Employee Name": d.name,
          Department: d.department,
          Date: dt.date,
          "OT Hours": dt.otHours,
        });
      }
    }
    return await exportToExcel(
      rows,
      "Overtime Report",
      `overtime-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`
    );
  }

  return apiResponse(data);
}

// ─── Report 5: Leave Summary ──────────────────────────────
async function leaveSummaryReport(
  start: Date,
  end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const year = start.getFullYear();

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      employeeCode: true,
      department: { select: { name: true } },
      leaveBalances: {
        where: { year },
        include: { leaveType: { select: { name: true, code: true } } },
      },
      leaveRequests: {
        where: {
          startDate: { gte: start },
          endDate: { lte: end },
          status: { in: ["APPROVED", "PENDING"] },
        },
        include: { leaveType: { select: { name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = users.map((u) => ({
    id: u.id,
    name: u.name,
    employeeCode: u.employeeCode || "-",
    department: u.department?.name || "-",
    balances: u.leaveBalances.map((b) => ({
      leaveType: b.leaveType.name,
      code: b.leaveType.code,
      allocated: b.allocated,
      used: b.used,
      pending: b.pending,
      balance: +(b.allocated - b.used - b.pending).toFixed(1),
    })),
    totalAllocated: u.leaveBalances.reduce((a, b) => a + b.allocated, 0),
    totalUsed: u.leaveBalances.reduce((a, b) => a + b.used, 0),
    totalPending: u.leaveBalances.reduce((a, b) => a + b.pending, 0),
    totalBalance: u.leaveBalances.reduce(
      (a, b) => a + (b.allocated - b.used - b.pending),
      0
    ),
  }));

  if (exportFormat === "excel") {
    // One row per user per leave type
    const rows: Array<Record<string, unknown>> = [];
    for (const d of data) {
      if (d.balances.length === 0) {
        rows.push({
          "Employee Code": d.employeeCode,
          "Employee Name": d.name,
          Department: d.department,
          "Leave Type": "-",
          Allocated: 0,
          Used: 0,
          Pending: 0,
          Balance: 0,
        });
      } else {
        for (const b of d.balances) {
          rows.push({
            "Employee Code": d.employeeCode,
            "Employee Name": d.name,
            Department: d.department,
            "Leave Type": b.leaveType,
            Allocated: b.allocated,
            Used: b.used,
            Pending: b.pending,
            Balance: b.balance,
          });
        }
      }
    }
    return await exportToExcel(
      rows,
      "Leave Summary",
      `leave-summary-${year}`
    );
  }

  return apiResponse(data);
}

// ─── Excel Export Helper ──────────────────────────────────
async function exportToExcel(
  data: Array<Record<string, unknown>>,
  sheetName: string,
  fileName: string
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(
      key.length + 2,
      ...data.map((row) => String(row[key] ?? "").length + 2)
    ),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
    },
  });
}
