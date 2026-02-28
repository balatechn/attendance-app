import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { sendEmail } from "@/lib/email";
import { formatInTimeZone } from "date-fns-tz";
import { subDays } from "date-fns";

const IST = "Asia/Kolkata";

/**
 * Daily attendance summary email — sent at 8 AM IST.
 * Shows yesterday's attendance grouped by Entity → Location → Employees.
 *
 * GET /api/cron/daily-summary           → sends real summary for yesterday
 * GET /api/cron/daily-summary?test=true → sends test summary (accessible by admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isTest = searchParams.get("test") === "true";

    // Auth: either cron secret or test mode (checked below)
    if (!isTest) {
      const authHeader = request.headers.get("authorization");
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return apiError("Unauthorized", 401);
      }
    }

    // For test mode, verify user is admin
    if (isTest) {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      if (!session?.user) return apiError("Unauthorized", 401);
      const { hasPermission } = await import("@/lib/rbac");
      type Role = import("@/generated/prisma/enums").Role;
      if (!hasPermission(session.user.role as Role, "settings:manage")) {
        return apiError("Forbidden", 403);
      }
    }

    // Get yesterday's date range in IST
    const now = new Date();
    const yesterday = subDays(now, 1);
    const yesterdayStr = formatInTimeZone(yesterday, IST, "yyyy-MM-dd");
    const displayDate = formatInTimeZone(yesterday, IST, "EEEE, MMMM d, yyyy");
    const dayStart = new Date(`${yesterdayStr}T00:00:00+05:30`);
    const dayEnd = new Date(`${yesterdayStr}T23:59:59+05:30`);

    // Fetch all active employees (excluding MANAGEMENT role) with their entity, location, department, and yesterday's data
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: "MANAGEMENT" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        entity: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        department: { select: { name: true } },
        shift: { select: { name: true, startTime: true, endTime: true } },
        sessions: {
          where: { timestamp: { gte: dayStart, lte: dayEnd } },
          orderBy: { timestamp: "asc" },
          select: { type: true, timestamp: true, address: true },
        },
        dailySummaries: {
          where: { date: { gte: dayStart, lte: dayEnd } },
          select: { status: true, totalWorkMins: true, firstCheckIn: true, lastCheckOut: true, overtimeMins: true },
        },
      },
      orderBy: [{ entity: { name: "asc" } }, { location: { name: "asc" } }, { name: "asc" }],
    });

    // Group by Entity → Location
    const entityMap = new Map<string, {
      entityName: string;
      locations: Map<string, {
        locationName: string;
        employees: typeof employees;
      }>;
    }>();

    for (const emp of employees) {
      const entityKey = emp.entity?.id || "unassigned";
      const entityName = emp.entity?.name || "Unassigned Entity";
      const locationKey = emp.location?.id || "unassigned";
      const locationName = emp.location?.name || "Unassigned Location";

      if (!entityMap.has(entityKey)) {
        entityMap.set(entityKey, { entityName, locations: new Map() });
      }
      const entity = entityMap.get(entityKey)!;
      if (!entity.locations.has(locationKey)) {
        entity.locations.set(locationKey, { locationName, employees: [] });
      }
      entity.locations.get(locationKey)!.employees.push(emp);
    }

    // Build stats
    const totalEmployees = employees.length;
    const presentEmployees = employees.filter((e) => {
      const status = e.dailySummaries[0]?.status;
      return status && ["PRESENT", "LATE", "HALF_DAY"].includes(status);
    }).length;
    const absentEmployees = totalEmployees - presentEmployees;
    const lateEmployees = employees.filter((e) => e.dailySummaries[0]?.status === "LATE").length;

    // Build HTML
    const emailHtml = buildDailySummaryEmail({
      displayDate,
      totalEmployees,
      presentEmployees,
      absentEmployees,
      lateEmployees,
      entityMap,
    });

    // Get admin recipients
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
      select: { email: true },
    });

    if (admins.length === 0) {
      return apiError("No admin recipients found", 404);
    }

    // Send to all admins
    const results = await Promise.allSettled(
      admins.map((admin) =>
        sendEmail({
          to: admin.email,
          subject: `📊 Daily Attendance Report — ${displayDate}`,
          html: emailHtml,
        })
      )
    );

    const details = results.map((r, i) => ({
      email: admins[i].email,
      success: r.status === "fulfilled" && (r.value as { success: boolean }).success,
      error: r.status === "rejected"
        ? String(r.reason)
        : r.status === "fulfilled" && !(r.value as { success: boolean }).success
          ? JSON.stringify((r.value as { error?: unknown }).error)
          : null,
    }));

    console.log(`Daily summary email sent: ${details.filter((d) => d.success).length}/${admins.length} succeeded`);

    return apiResponse({
      message: "Daily summary sent",
      date: yesterdayStr,
      stats: { totalEmployees, presentEmployees, absentEmployees, lateEmployees },
      recipients: details,
    });
  } catch (error) {
    console.error("Daily summary cron error:", error);
    return apiError("Internal server error", 500);
  }
}

// ─── Email Builder ───────────────────────────────────────────

interface SummaryData {
  displayDate: string;
  totalEmployees: number;
  presentEmployees: number;
  absentEmployees: number;
  lateEmployees: number;
  entityMap: Map<string, {
    entityName: string;
    locations: Map<string, {
      locationName: string;
      employees: Array<{
        name: string;
        email: string;
        employeeCode: string | null;
        department: { name: string } | null;
        shift: { name: string; startTime: string; endTime: string } | null;
        sessions: Array<{ type: string; timestamp: Date; address: string | null }>;
        dailySummaries: Array<{ status: string; totalWorkMins: number; firstCheckIn: Date | null; lastCheckOut: Date | null; overtimeMins: number }>;
      }>;
    }>;
  }>;
}

function buildDailySummaryEmail(data: SummaryData): string {
  const { displayDate, totalEmployees, presentEmployees, absentEmployees, lateEmployees, entityMap } = data;
  const presentPct = totalEmployees > 0 ? Math.round((presentEmployees / totalEmployees) * 100) : 0;

  let entitySections = "";

  for (const [, entity] of entityMap) {
    let locationRows = "";

    for (const [, loc] of entity.locations) {
      const locPresent = loc.employees.filter((e) => {
        const s = e.dailySummaries[0]?.status;
        return s && ["PRESENT", "LATE", "HALF_DAY"].includes(s);
      }).length;
      const locAbsent = loc.employees.length - locPresent;

      // Employee rows
      let empRows = "";
      for (const emp of loc.employees) {
        const summary = emp.dailySummaries[0];
        const status = summary?.status || "ABSENT";
        const firstIn = summary?.firstCheckIn
          ? formatInTimeZone(new Date(summary.firstCheckIn), IST, "hh:mm a")
          : "—";
        const lastOut = summary?.lastCheckOut
          ? formatInTimeZone(new Date(summary.lastCheckOut), IST, "hh:mm a")
          : "—";
        const workHrs = summary
          ? `${Math.floor(summary.totalWorkMins / 60)}h ${summary.totalWorkMins % 60}m`
          : "—";

        const statusColor = {
          PRESENT: "#16a34a",
          LATE: "#f59e0b",
          HALF_DAY: "#f97316",
          ABSENT: "#dc2626",
          ON_LEAVE: "#8b5cf6",
        }[status] || "#6b7280";

        empRows += `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">
              ${emp.name}${emp.employeeCode ? ` <span style="color:#94a3b8;font-size:11px;">(${emp.employeeCode})</span>` : ""}
            </td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">${emp.department?.name || "—"}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;">
              <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:${statusColor};">${status.replace("_", " ")}</span>
            </td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;text-align:center;">${firstIn}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;text-align:center;">${lastOut}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;text-align:center;">${workHrs}</td>
          </tr>`;
      }

      locationRows += `
        <tr>
          <td colspan="6" style="padding:8px 10px;background:#f0f9ff;font-size:13px;font-weight:600;color:#0369a1;border-bottom:1px solid #bae6fd;">
            📍 ${loc.locationName}
            <span style="font-weight:400;color:#64748b;font-size:12px;margin-left:8px;">
              ${locPresent} present · ${locAbsent} absent · ${loc.employees.length} total
            </span>
          </td>
        </tr>
        ${empRows}`;
    }

    entitySections += `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr>
          <td colspan="6" style="padding:10px 12px;background:linear-gradient(135deg,#1e40af,#3b82f6);font-size:14px;font-weight:700;color:#ffffff;">
            🏢 ${entity.entityName}
          </td>
        </tr>
        <tr style="background:#f8fafc;">
          <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Employee</td>
          <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Dept</td>
          <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Status</td>
          <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Check In</td>
          <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Check Out</td>
          <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Work Hrs</td>
        </tr>
        ${locationRows}
      </table>`;
  }

  return `
    <h2 style="color:#1e293b;margin:0 0 4px;">📊 Daily Attendance Report</h2>
    <p style="color:#64748b;margin:0 0 20px;font-size:14px;">${displayDate}</p>

    <!-- Overview Stats -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="width:25%;padding:12px;background:#f0fdf4;border-radius:8px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#16a34a;">${presentEmployees}</div>
          <div style="font-size:11px;color:#65a30d;text-transform:uppercase;font-weight:600;">Present</div>
        </td>
        <td style="width:4px;"></td>
        <td style="width:25%;padding:12px;background:#fef2f2;border-radius:8px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#dc2626;">${absentEmployees}</div>
          <div style="font-size:11px;color:#dc2626;text-transform:uppercase;font-weight:600;">Absent</div>
        </td>
        <td style="width:4px;"></td>
        <td style="width:25%;padding:12px;background:#fffbeb;border-radius:8px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#f59e0b;">${lateEmployees}</div>
          <div style="font-size:11px;color:#d97706;text-transform:uppercase;font-weight:600;">Late</div>
        </td>
        <td style="width:4px;"></td>
        <td style="width:25%;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#334155;">${totalEmployees}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;">Total (${presentPct}%)</div>
        </td>
      </tr>
    </table>

    <!-- Entity / Location Breakdown -->
    ${entitySections}

    <p style="color:#94a3b8;font-size:12px;margin-top:20px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://attendease.nationalgroupindia.com"}/dashboard/admin-reports" style="color:#3b82f6;text-decoration:none;font-weight:600;">
        View Full Report in App →
      </a>
    </p>
  `;
}
