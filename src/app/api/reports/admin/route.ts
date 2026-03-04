import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import type { Role } from "@/generated/prisma/enums";
import { formatIST } from "@/lib/datetime";
import { eachDayOfInterval, getDay } from "date-fns";

/** Count working days (Mon-Sat, excluding Sundays) */
function countWorkingDays(start: Date, end: Date): number {
  const now = new Date();
  const effectiveEnd = end > now ? now : end;
  if (effectiveEnd < start) return 0;
  return eachDayOfInterval({ start, end: effectiveEnd }).filter(
    (d) => getDay(d) !== 0
  ).length;
}

/** Get Monday date string for a given date (for weekly grouping) */
function getMondayKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return formatIST(d, "yyyy-MM-dd");
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (role !== "SUPER_ADMIN") {
      return apiError("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") || "attendance-summary";
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const departmentId = searchParams.get("department") || "";
    const entityId = searchParams.get("entity") || "";
    const locationId = searchParams.get("location") || "";
    const exportFormat = searchParams.get("export");

    if (!startDate || !endDate) {
      return apiError("Start and end dates are required", 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const userWhere: Record<string, unknown> = { isActive: true, role: { not: "MANAGEMENT" } };
    if (departmentId) userWhere.departmentId = departmentId;
    if (entityId) userWhere.entityId = entityId;
    if (locationId) userWhere.locationId = locationId;

    if (role !== "SUPER_ADMIN" && session.user.entityId) {
      if (!entityId) userWhere.entityId = session.user.entityId;
    }

    switch (reportType) {
      case "attendance-summary":
        return await attendanceSummaryReport(start, end, userWhere, exportFormat);
      case "daily-attendance":
        return await dailyAttendanceReport(start, userWhere, exportFormat);
      case "detailed-log":
        return await detailedLogReport(start, end, userWhere, exportFormat);
      case "weekly-report":
        return await weeklyReport(start, end, userWhere, exportFormat);
      case "monthly-payroll":
        return await monthlyPayrollReport(start, end, userWhere, exportFormat);
      case "late-arrivals":
        return await lateArrivalsReport(start, end, userWhere, exportFormat);
      case "overtime":
        return await overtimeReport(start, end, userWhere, exportFormat);
      case "leave-summary":
        return await leaveSummaryReport(start, end, userWhere, exportFormat);
      case "regularization":
        return await regularizationReport(start, end, userWhere, exportFormat);
      case "discrepancy":
        return await discrepancyReport(start, end, userWhere, exportFormat);
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
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, email: true, employeeCode: true, role: true,
      department: { select: { name: true } },
      dailySummaries: { where: { date: { gte: start, lte: end } } },
    },
    orderBy: { name: "asc" },
  });

  const data = users.map((u) => {
    const summaries = u.dailySummaries;
    const presentDays = summaries.filter((s) => s.status === "PRESENT" || s.status === "LATE").length;
    const absentDays = summaries.filter((s) => s.status === "ABSENT").length;
    const lateDays = summaries.filter((s) => s.status === "LATE").length;
    const halfDays = summaries.filter((s) => s.status === "HALF_DAY").length;
    const onLeaveDays = summaries.filter((s) => s.status === "ON_LEAVE").length;
    const totalWorkMins = summaries.reduce((a, s) => a + s.totalWorkMins, 0);
    const totalOTMins = summaries.reduce((a, s) => a + s.overtimeMins, 0);
    const effectiveTotalDays = summaries.length;

    return {
      id: u.id, name: u.name, email: u.email,
      employeeCode: u.employeeCode || "-",
      department: u.department?.name || "-",
      role: u.role,
      totalDays: effectiveTotalDays, presentDays, absentDays, lateDays, halfDays, onLeaveDays,
      totalWorkHours: +(totalWorkMins / 60).toFixed(1),
      avgDailyHours: effectiveTotalDays > 0 ? +(totalWorkMins / 60 / effectiveTotalDays).toFixed(1) : 0,
      totalOTHours: +(totalOTMins / 60).toFixed(1),
    };
  });

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode, "Employee Name": d.name, Department: d.department,
        "Total Days": d.totalDays, "Present Days": d.presentDays, "Absent Days": d.absentDays,
        "Late Days": d.lateDays, "Half Days": d.halfDays, "On Leave": d.onLeaveDays,
        "Total Work Hours": d.totalWorkHours, "Avg Daily Hours": d.avgDailyHours, "Overtime Hours": d.totalOTHours,
      })),
      "Attendance Summary",
      `attendance-summary-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`
    );
  }

  return apiResponse(data);
}

// ─── Report 2: Daily Attendance (Enhanced) ────────────────
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
      id: true, name: true, email: true, employeeCode: true, role: true,
      department: { select: { name: true } },
      dailySummaries: { where: { date: { gte: dayStart, lte: dayEnd } }, take: 1 },
      sessions: {
        where: { timestamp: { gte: dayStart, lte: dayEnd } },
        orderBy: { timestamp: "asc" },
        select: { type: true, address: true, note: true },
      },
      regularizations: {
        where: { date: { gte: dayStart, lte: dayEnd } },
        take: 1,
        select: { type: true, status: true, reason: true },
      },
      leaveRequests: {
        where: { startDate: { lte: dayEnd }, endDate: { gte: dayStart }, status: { in: ["APPROVED", "PENDING"] } },
        include: { leaveType: { select: { name: true } } },
        take: 1,
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
    const reg = u.regularizations?.[0];
    const leave = u.leaveRequests?.[0];

    return {
      id: u.id, name: u.name,
      employeeCode: u.employeeCode || "-",
      department: u.department?.name || "-",
      status: summary?.status || "ABSENT",
      firstCheckIn: summary?.firstCheckIn ? formatIST(summary.firstCheckIn, "HH:mm") : "-",
      lastCheckOut: summary?.lastCheckOut ? formatIST(summary.lastCheckOut, "HH:mm") : "-",
      checkInLocation: firstCheckInSession?.address || "-",
      checkOutLocation: lastCheckOutSession?.address || "-",
      checkInNote: firstCheckInSession?.note || "-",
      checkOutNote: lastCheckOutSession?.note || "-",
      workHours: summary ? +(summary.totalWorkMins / 60).toFixed(1) : 0,
      breakHours: summary ? +(summary.totalBreakMins / 60).toFixed(1) : 0,
      sessions: summary?.sessionCount || 0,
      isLate: summary?.status === "LATE",
      // Regularization
      regApplied: !!reg,
      regType: reg?.type?.replace(/_/g, " ") || "-",
      regStatus: reg?.status || "-",
      regReason: reg?.reason || "-",
      // Leave
      leaveApplied: !!leave,
      leaveType: leave?.leaveType?.name || "-",
      leaveStatus: leave?.status || "-",
    };
  });

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode, "Employee Name": d.name, Department: d.department,
        Status: d.status, "Check-In": d.firstCheckIn, "Check-In Location": d.checkInLocation,
        "Check-In Note": d.checkInNote, "Check-Out": d.lastCheckOut,
        "Check-Out Location": d.checkOutLocation, "Check-Out Note": d.checkOutNote,
        "Work Hours": d.workHours, "Break Hours": d.breakHours, Sessions: d.sessions,
        "Reg. Applied": d.regApplied ? "Yes" : "No", "Reg. Type": d.regType,
        "Reg. Status": d.regStatus, "Reg. Reason": d.regReason,
        "Leave Applied": d.leaveApplied ? "Yes" : "No", "Leave Type": d.leaveType,
        "Leave Status": d.leaveStatus,
      })),
      "Daily Attendance",
      `daily-attendance-${formatIST(date, "yyyy-MM-dd")}`
    );
  }

  return apiResponse(data);
}

// ─── Report 3: Detailed Attendance Log ────────────────────
async function detailedLogReport(
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, employeeCode: true, designation: true,
      department: { select: { name: true } },
      shift: { select: { name: true, startTime: true, standardWorkMins: true } },
      dailySummaries: { where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" } },
      sessions: {
        where: { timestamp: { gte: start, lte: end } },
        orderBy: { timestamp: "asc" },
        select: { type: true, timestamp: true, address: true, note: true, isAutoOut: true },
      },
      regularizations: {
        where: { date: { gte: start, lte: end } },
        select: { date: true, type: true, reason: true, status: true, reviewNote: true },
      },
      leaveRequests: {
        where: { startDate: { lte: end }, endDate: { gte: start }, status: { in: ["APPROVED", "PENDING"] } },
        include: { leaveType: { select: { name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const days = eachDayOfInterval({ start, end }).filter((d) => getDay(d) !== 0);

  interface LogEntry {
    employeeId: string; name: string; employeeCode: string; designation: string;
    department: string; shift: string; date: string; dayName: string; status: string;
    checkIn: string; checkOut: string; checkInLocation: string; checkOutLocation: string;
    checkInNote: string; checkOutNote: string; workHours: number; breakHours: number;
    otHours: number; sessions: number; isAutoOut: boolean;
    regApplied: boolean; regType: string; regStatus: string; regReason: string;
    leaveApplied: boolean; leaveType: string; leaveStatus: string;
  }

  const data: LogEntry[] = [];

  for (const user of users) {
    for (const day of days) {
      const dayStr = formatIST(day, "yyyy-MM-dd");
      const summary = user.dailySummaries.find((s) => formatIST(s.date, "yyyy-MM-dd") === dayStr);

      const daySessions = user.sessions.filter(
        (s) => formatIST(s.timestamp, "yyyy-MM-dd") === dayStr
      );
      const firstCheckIn = daySessions.find((s) => s.type === "CHECK_IN");
      const checkOuts = daySessions.filter((s) => s.type === "CHECK_OUT");
      const lastCheckOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1] : null;

      const reg = user.regularizations.find((r) => formatIST(r.date, "yyyy-MM-dd") === dayStr);
      const leave = user.leaveRequests.find(
        (l) => day >= new Date(l.startDate) && day <= new Date(l.endDate)
      );

      data.push({
        employeeId: user.id, name: user.name,
        employeeCode: user.employeeCode || "-",
        designation: user.designation || "-",
        department: user.department?.name || "-",
        shift: user.shift?.name || "General",
        date: dayStr, dayName: formatIST(day, "EEE"),
        status: summary?.status || "ABSENT",
        checkIn: summary?.firstCheckIn ? formatIST(summary.firstCheckIn, "HH:mm") : "-",
        checkOut: summary?.lastCheckOut ? formatIST(summary.lastCheckOut, "HH:mm") : "-",
        checkInLocation: firstCheckIn?.address || "-",
        checkOutLocation: lastCheckOut?.address || "-",
        checkInNote: firstCheckIn?.note || "-",
        checkOutNote: lastCheckOut?.note || "-",
        workHours: summary ? +(summary.totalWorkMins / 60).toFixed(1) : 0,
        breakHours: summary ? +(summary.totalBreakMins / 60).toFixed(1) : 0,
        otHours: summary ? +(summary.overtimeMins / 60).toFixed(1) : 0,
        sessions: summary?.sessionCount || 0,
        isAutoOut: lastCheckOut?.isAutoOut || false,
        regApplied: !!reg, regType: reg?.type?.replace(/_/g, " ") || "-",
        regStatus: reg?.status || "-", regReason: reg?.reason || "-",
        leaveApplied: !!leave, leaveType: leave?.leaveType?.name || "-",
        leaveStatus: leave?.status || "-",
      });
    }
  }

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode, "Employee Name": d.name,
        Designation: d.designation, Department: d.department, Shift: d.shift,
        Date: d.date, Day: d.dayName, Status: d.status,
        "Check-In": d.checkIn, "Check-In Location": d.checkInLocation, "Check-In Note": d.checkInNote,
        "Check-Out": d.checkOut, "Check-Out Location": d.checkOutLocation, "Check-Out Note": d.checkOutNote,
        "Work Hours": d.workHours, "Break Hours": d.breakHours, "OT Hours": d.otHours,
        Sessions: d.sessions, "Auto Check-Out": d.isAutoOut ? "Yes" : "No",
        "Reg. Applied": d.regApplied ? "Yes" : "No", "Reg. Type": d.regType,
        "Reg. Status": d.regStatus, "Reg. Reason": d.regReason,
        "Leave Applied": d.leaveApplied ? "Yes" : "No", "Leave Type": d.leaveType,
        "Leave Status": d.leaveStatus,
      })),
      "Detailed Attendance Log",
      `detailed-log-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`
    );
  }

  return apiResponse(data);
}

// ─── Report 4: Weekly Report ──────────────────────────────
async function weeklyReport(
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, employeeCode: true,
      department: { select: { name: true } },
      dailySummaries: { where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  interface WeekEntry {
    employeeId: string; name: string; employeeCode: string; department: string;
    weekLabel: string; weekStart: string;
    presentDays: number; absentDays: number; lateDays: number; halfDays: number;
    leaveDays: number; totalWorkHours: number; totalOTHours: number; avgDailyHours: number;
  }

  const data: WeekEntry[] = [];

  for (const user of users) {
    // Group summaries by week (Monday start)
    const weekMap = new Map<string, typeof user.dailySummaries>();
    for (const s of user.dailySummaries) {
      const mondayKey = getMondayKey(s.date);
      if (!weekMap.has(mondayKey)) weekMap.set(mondayKey, []);
      weekMap.get(mondayKey)!.push(s);
    }

    for (const [monday, summaries] of weekMap) {
      const presentDays = summaries.filter((s) => s.status === "PRESENT" || s.status === "LATE").length;
      const totalWorkMins = summaries.reduce((a, s) => a + s.totalWorkMins, 0);
      const totalOTMins = summaries.reduce((a, s) => a + s.overtimeMins, 0);

      data.push({
        employeeId: user.id, name: user.name,
        employeeCode: user.employeeCode || "-",
        department: user.department?.name || "-",
        weekLabel: `Week of ${monday}`,
        weekStart: monday,
        presentDays,
        absentDays: summaries.filter((s) => s.status === "ABSENT").length,
        lateDays: summaries.filter((s) => s.status === "LATE").length,
        halfDays: summaries.filter((s) => s.status === "HALF_DAY").length,
        leaveDays: summaries.filter((s) => s.status === "ON_LEAVE").length,
        totalWorkHours: +(totalWorkMins / 60).toFixed(1),
        totalOTHours: +(totalOTMins / 60).toFixed(1),
        avgDailyHours: summaries.length > 0 ? +(totalWorkMins / 60 / summaries.length).toFixed(1) : 0,
      });
    }
  }

  // Sort by employee then by week
  data.sort((a, b) => a.name.localeCompare(b.name) || a.weekStart.localeCompare(b.weekStart));

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode, "Employee Name": d.name, Department: d.department,
        Week: d.weekLabel, "Present": d.presentDays, "Absent": d.absentDays,
        "Late": d.lateDays, "Half Day": d.halfDays, "On Leave": d.leaveDays,
        "Work Hours": d.totalWorkHours, "OT Hours": d.totalOTHours, "Avg Hrs/Day": d.avgDailyHours,
      })),
      "Weekly Report",
      `weekly-report-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`
    );
  }

  return apiResponse(data);
}

// ─── Report 5: Monthly Payroll Report ─────────────────────
async function monthlyPayrollReport(
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const year = start.getFullYear();
  const month = start.getMonth();
  const totalWorkingDays = countWorkingDays(start, end);

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, employeeCode: true, designation: true,
      department: { select: { name: true } },
      shift: { select: { name: true, standardWorkMins: true } },
      dailySummaries: { where: { date: { gte: start, lte: end } } },
      regularizations: {
        where: { date: { gte: start, lte: end } },
        select: { status: true },
      },
      leaveRequests: {
        where: { startDate: { lte: end }, endDate: { gte: start }, status: "APPROVED" },
        include: { leaveType: { select: { name: true } } },
      },
      leaveBalances: {
        where: { year },
        include: { leaveType: { select: { name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = users.map((u) => {
    const summaries = u.dailySummaries;
    const presentDays = summaries.filter((s) => s.status === "PRESENT" || s.status === "LATE").length;
    const absentDays = summaries.filter((s) => s.status === "ABSENT").length;
    const lateDays = summaries.filter((s) => s.status === "LATE").length;
    const halfDays = summaries.filter((s) => s.status === "HALF_DAY").length;
    const leaveDays = summaries.filter((s) => s.status === "ON_LEAVE").length;
    const totalWorkMins = summaries.reduce((a, s) => a + s.totalWorkMins, 0);
    const totalOTMins = summaries.reduce((a, s) => a + s.overtimeMins, 0);
    const standardMins = u.shift?.standardWorkMins || 480;
    const shortHoursDays = summaries.filter(
      (s) => (s.status === "PRESENT" || s.status === "LATE") && s.totalWorkMins < standardMins * 0.75
    ).length;

    // Effective days = present + late + (half * 0.5)
    const effectiveDays = +(presentDays + halfDays * 0.5).toFixed(1);

    // Leave type breakdown from approved requests
    const leaveBreakdown: Array<{ type: string; days: number }> = [];
    for (const lr of u.leaveRequests) {
      const existing = leaveBreakdown.find((lb) => lb.type === lr.leaveType.name);
      if (existing) existing.days += lr.days;
      else leaveBreakdown.push({ type: lr.leaveType.name, days: lr.days });
    }

    return {
      id: u.id, name: u.name,
      employeeCode: u.employeeCode || "-",
      designation: u.designation || "-",
      department: u.department?.name || "-",
      shift: u.shift?.name || "General",
      totalWorkingDays,
      presentDays, absentDays, lateDays, halfDays, leaveDays, effectiveDays,
      totalWorkHours: +(totalWorkMins / 60).toFixed(1),
      totalOTHours: +(totalOTMins / 60).toFixed(1),
      avgDailyHours: summaries.length > 0 ? +(totalWorkMins / 60 / summaries.length).toFixed(1) : 0,
      shortHoursDays,
      regsApproved: u.regularizations.filter((r) => r.status === "APPROVED").length,
      regsPending: u.regularizations.filter((r) => r.status === "PENDING").length,
      leaveBreakdown,
      leaveBalance: u.leaveBalances.map((b) => ({
        type: b.leaveType.name,
        allocated: b.allocated, used: b.used, balance: +(b.allocated - b.used - b.pending).toFixed(1),
      })),
    };
  });

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode, "Employee Name": d.name,
        Designation: d.designation, Department: d.department, Shift: d.shift,
        "Working Days": d.totalWorkingDays, "Present": d.presentDays,
        "Absent": d.absentDays, "Late": d.lateDays, "Half Day": d.halfDays,
        "On Leave": d.leaveDays, "Effective Days": d.effectiveDays,
        "Work Hours": d.totalWorkHours, "OT Hours": d.totalOTHours,
        "Avg Hrs/Day": d.avgDailyHours, "Short Hours Days": d.shortHoursDays,
        "Reg. Approved": d.regsApproved, "Reg. Pending": d.regsPending,
        "Leave Details": d.leaveBreakdown.map((l) => `${l.type}: ${l.days}d`).join(", ") || "None",
      })),
      "Monthly Payroll Report",
      `payroll-${year}-${String(month + 1).padStart(2, "0")}`
    );
  }

  return apiResponse(data);
}

// ─── Report 6: Late Arrivals ──────────────────────────────
async function lateArrivalsReport(
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, employeeCode: true,
      department: { select: { name: true } },
      shift: { select: { name: true, startTime: true } },
      dailySummaries: {
        where: { date: { gte: start, lte: end }, status: "LATE" },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const flatData: Array<Record<string, unknown>> = [];
  const summaryData: Array<{
    id: string; name: string; employeeCode: string; department: string;
    shift: string; lateDays: number; dates: Array<{ date: string; checkIn: string }>;
  }> = [];

  for (const u of users) {
    if (u.dailySummaries.length === 0) continue;

    const dates = u.dailySummaries.map((s) => ({
      date: formatIST(s.date, "yyyy-MM-dd"),
      checkIn: s.firstCheckIn ? formatIST(s.firstCheckIn, "HH:mm") : "-",
    }));

    summaryData.push({
      id: u.id, name: u.name,
      employeeCode: u.employeeCode || "-",
      department: u.department?.name || "-",
      shift: u.shift ? `${u.shift.name} (${u.shift.startTime})` : "General",
      lateDays: u.dailySummaries.length, dates,
    });

    for (const s of u.dailySummaries) {
      flatData.push({
        "Employee Code": u.employeeCode || "-", "Employee Name": u.name,
        Department: u.department?.name || "-",
        Shift: u.shift ? `${u.shift.name} (${u.shift.startTime})` : "General",
        Date: formatIST(s.date, "yyyy-MM-dd"),
        "Check-In Time": s.firstCheckIn ? formatIST(s.firstCheckIn, "HH:mm") : "-",
      });
    }
  }

  if (exportFormat === "excel") {
    return await exportToExcel(flatData, "Late Arrivals",
      `late-arrivals-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`);
  }

  summaryData.sort((a, b) => b.lateDays - a.lateDays);
  return apiResponse(summaryData);
}

// ─── Report 7: Overtime Report ────────────────────────────
async function overtimeReport(
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, employeeCode: true,
      department: { select: { name: true } },
      dailySummaries: {
        where: { date: { gte: start, lte: end }, overtimeMins: { gt: 0 } },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = users
    .filter((u) => u.dailySummaries.length > 0)
    .map((u) => {
      const totalOTMins = u.dailySummaries.reduce((a, s) => a + s.overtimeMins, 0);
      return {
        id: u.id, name: u.name,
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
    const rows: Array<Record<string, unknown>> = [];
    for (const d of data) {
      for (const dt of d.dates) {
        rows.push({
          "Employee Code": d.employeeCode, "Employee Name": d.name,
          Department: d.department, Date: dt.date, "OT Hours": dt.otHours,
        });
      }
    }
    return await exportToExcel(rows, "Overtime Report",
      `overtime-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`);
  }

  return apiResponse(data);
}

// ─── Report 8: Leave Summary ──────────────────────────────
async function leaveSummaryReport(
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const year = start.getFullYear();

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, employeeCode: true,
      department: { select: { name: true } },
      leaveBalances: {
        where: { year },
        include: { leaveType: { select: { name: true, code: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = users.map((u) => ({
    id: u.id, name: u.name,
    employeeCode: u.employeeCode || "-",
    department: u.department?.name || "-",
    balances: u.leaveBalances.map((b) => ({
      leaveType: b.leaveType.name, code: b.leaveType.code,
      allocated: b.allocated, used: b.used, pending: b.pending,
      balance: +(b.allocated - b.used - b.pending).toFixed(1),
    })),
    totalAllocated: u.leaveBalances.reduce((a, b) => a + b.allocated, 0),
    totalUsed: u.leaveBalances.reduce((a, b) => a + b.used, 0),
    totalPending: u.leaveBalances.reduce((a, b) => a + b.pending, 0),
    totalBalance: u.leaveBalances.reduce((a, b) => a + (b.allocated - b.used - b.pending), 0),
  }));

  if (exportFormat === "excel") {
    const rows: Array<Record<string, unknown>> = [];
    for (const d of data) {
      if (d.balances.length === 0) {
        rows.push({
          "Employee Code": d.employeeCode, "Employee Name": d.name, Department: d.department,
          "Leave Type": "-", Allocated: 0, Used: 0, Pending: 0, Balance: 0,
        });
      } else {
        for (const b of d.balances) {
          rows.push({
            "Employee Code": d.employeeCode, "Employee Name": d.name, Department: d.department,
            "Leave Type": b.leaveType, Allocated: b.allocated, Used: b.used,
            Pending: b.pending, Balance: b.balance,
          });
        }
      }
    }
    return await exportToExcel(rows, "Leave Summary", `leave-summary-${year}`);
  }

  return apiResponse(data);
}

// ─── Report 9: Regularization Report ──────────────────────
async function regularizationReport(
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  // Get matching employee IDs first
  const employees = await prisma.user.findMany({
    where: userWhere,
    select: { id: true },
  });
  const empIds = employees.map((e) => e.id);

  const regs = await prisma.regularization.findMany({
    where: {
      date: { gte: start, lte: end },
      employeeId: { in: empIds },
    },
    include: {
      employee: { select: { name: true, employeeCode: true, department: { select: { name: true } } } },
      approver: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  const data = regs.map((r) => ({
    id: r.id,
    employeeName: r.employee.name,
    employeeCode: r.employee.employeeCode || "-",
    department: r.employee.department?.name || "-",
    date: formatIST(r.date, "yyyy-MM-dd"),
    type: r.type.replace(/_/g, " "),
    reason: r.reason,
    requestedTime: r.requestedTime ? formatIST(r.requestedTime, "HH:mm") : "-",
    status: r.status,
    reviewer: r.approver?.name || "-",
    reviewNote: r.reviewNote || "-",
    createdAt: formatIST(r.createdAt, "yyyy-MM-dd HH:mm"),
  }));

  // Summary stats
  const stats = {
    total: data.length,
    approved: data.filter((d) => d.status === "APPROVED").length,
    pending: data.filter((d) => d.status === "PENDING").length,
    rejected: data.filter((d) => d.status === "REJECTED").length,
  };

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode, "Employee Name": d.employeeName,
        Department: d.department, Date: d.date, Type: d.type,
        "Requested Time": d.requestedTime, Reason: d.reason,
        Status: d.status, Reviewer: d.reviewer, "Review Note": d.reviewNote,
        "Submitted At": d.createdAt,
      })),
      "Regularization Report",
      `regularization-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`
    );
  }

  return apiResponse({ stats, data });
}

// ─── Report 10: Discrepancy Report ────────────────────────
async function discrepancyReport(
  start: Date, end: Date,
  userWhere: Record<string, unknown>,
  exportFormat: string | null
) {
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, employeeCode: true,
      department: { select: { name: true } },
      shift: { select: { standardWorkMins: true } },
      dailySummaries: { where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" } },
      sessions: {
        where: { timestamp: { gte: start, lte: end } },
        orderBy: { timestamp: "asc" },
        select: { type: true, timestamp: true, isAutoOut: true },
      },
      regularizations: {
        where: { date: { gte: start, lte: end } },
        select: { date: true, status: true },
      },
      leaveRequests: {
        where: { startDate: { lte: end }, endDate: { gte: start }, status: "APPROVED" },
        select: { startDate: true, endDate: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const days = eachDayOfInterval({ start, end }).filter((d) => getDay(d) !== 0);

  interface Discrepancy {
    employeeId: string; name: string; employeeCode: string; department: string;
    date: string; type: string; detail: string;
    hasReg: boolean; regStatus: string;
  }

  const data: Discrepancy[] = [];

  for (const user of users) {
    const stdMins = user.shift?.standardWorkMins || 480;

    for (const day of days) {
      const dayStr = formatIST(day, "yyyy-MM-dd");
      const summary = user.dailySummaries.find((s) => formatIST(s.date, "yyyy-MM-dd") === dayStr);
      const reg = user.regularizations.find((r) => formatIST(r.date, "yyyy-MM-dd") === dayStr);
      const hasApprovedLeave = user.leaveRequests.some(
        (l) => day >= new Date(l.startDate) && day <= new Date(l.endDate)
      );

      const daySessions = user.sessions.filter(
        (s) => formatIST(s.timestamp, "yyyy-MM-dd") === dayStr
      );
      const hasAutoOut = daySessions.some((s) => s.isAutoOut);

      // Discrepancy: Missing check-out (auto-out)
      if (hasAutoOut && summary) {
        data.push({
          employeeId: user.id, name: user.name,
          employeeCode: user.employeeCode || "-",
          department: user.department?.name || "-",
          date: dayStr, type: "Missing Check-Out",
          detail: "Auto check-out was triggered (employee did not check out manually)",
          hasReg: !!reg, regStatus: reg?.status || "-",
        });
      }

      // Discrepancy: Absent without leave or regularization
      if (summary?.status === "ABSENT" && !hasApprovedLeave && !reg) {
        data.push({
          employeeId: user.id, name: user.name,
          employeeCode: user.employeeCode || "-",
          department: user.department?.name || "-",
          date: dayStr, type: "Absent - No Leave/Reg",
          detail: "Marked absent without approved leave or regularization request",
          hasReg: false, regStatus: "-",
        });
      }

      // Discrepancy: Short hours (< 75% of standard)
      if (summary && (summary.status === "PRESENT" || summary.status === "LATE") &&
          summary.totalWorkMins < stdMins * 0.75 && summary.totalWorkMins > 0) {
        const worked = +(summary.totalWorkMins / 60).toFixed(1);
        const expected = +(stdMins / 60).toFixed(1);
        data.push({
          employeeId: user.id, name: user.name,
          employeeCode: user.employeeCode || "-",
          department: user.department?.name || "-",
          date: dayStr, type: "Short Hours",
          detail: `Worked ${worked}h vs expected ${expected}h (${Math.round((summary.totalWorkMins / stdMins) * 100)}%)`,
          hasReg: !!reg, regStatus: reg?.status || "-",
        });
      }

      // Discrepancy: Late without regularization
      if (summary?.status === "LATE" && !reg) {
        data.push({
          employeeId: user.id, name: user.name,
          employeeCode: user.employeeCode || "-",
          department: user.department?.name || "-",
          date: dayStr, type: "Late - No Reg",
          detail: "Late arrival without regularization request",
          hasReg: false, regStatus: "-",
        });
      }
    }
  }

  // Stats
  const stats = {
    total: data.length,
    missingCheckout: data.filter((d) => d.type === "Missing Check-Out").length,
    absentNoLeave: data.filter((d) => d.type === "Absent - No Leave/Reg").length,
    shortHours: data.filter((d) => d.type === "Short Hours").length,
    lateNoReg: data.filter((d) => d.type === "Late - No Reg").length,
  };

  if (exportFormat === "excel") {
    return await exportToExcel(
      data.map((d) => ({
        "Employee Code": d.employeeCode, "Employee Name": d.name,
        Department: d.department, Date: d.date, "Discrepancy Type": d.type,
        Detail: d.detail, "Has Regularization": d.hasReg ? "Yes" : "No",
        "Reg. Status": d.regStatus,
      })),
      "Discrepancy Report",
      `discrepancy-${formatIST(start, "yyyy-MM-dd")}-to-${formatIST(end, "yyyy-MM-dd")}`
    );
  }

  return apiResponse({ stats, data });
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

  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(key.length + 2, ...data.map((row) => String(row[key] ?? "").length + 2)),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
    },
  });
}
