import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { sendEmail } from "@/lib/email";
import { formatInTimeZone } from "date-fns-tz";
import { subDays } from "date-fns";

const IST = "Asia/Kolkata";

/**
 * Daily attendance summary email — sent at 8 AM IST.
 * Sends SEPARATE emails per entity to SUPER_ADMIN only.
 * Each email contains that entity's Location → Employee breakdown.
 *
 * GET /api/cron/daily-summary           → sends real summary for yesterday
 * GET /api/cron/daily-summary?test=true → sends test summary (accessible by admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isTest = searchParams.get("test") === "true";

    // Auth: either cron secret or test mode
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

    // Fetch all active employees (excluding MANAGEMENT) with yesterday's data
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
      orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
    });

    // Group by Entity
    const entityMap = new Map<string, {
      entityName: string;
      employees: typeof employees;
    }>();

    for (const emp of employees) {
      const entityKey = emp.entity?.id || "unassigned";
      const entityName = emp.entity?.name || "Unassigned Entity";

      if (!entityMap.has(entityKey)) {
        entityMap.set(entityKey, { entityName, employees: [] });
      }
      entityMap.get(entityKey)!.employees.push(emp);
    }

    // Get SUPER_ADMIN recipients only
    const superAdmins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: { email: true },
    });

    if (superAdmins.length === 0) {
      return apiError("No SUPER_ADMIN recipients found", 404);
    }

    const recipientEmails = superAdmins.map((a) => a.email);

    // Send one email per entity
    const allResults: Array<{ entity: string; email: string; success: boolean; error: string | null }> = [];

    for (const [, entityData] of entityMap) {
      const { entityName, employees: entityEmployees } = entityData;

      // Group entity employees by location
      const locationMap = new Map<string, {
        locationName: string;
        employees: typeof entityEmployees;
      }>();

      for (const emp of entityEmployees) {
        const locKey = emp.location?.id || "unassigned";
        const locName = emp.location?.name || "Unassigned Location";
        if (!locationMap.has(locKey)) {
          locationMap.set(locKey, { locationName: locName, employees: [] });
        }
        locationMap.get(locKey)!.employees.push(emp);
      }

      // Calculate entity-level stats
      const total = entityEmployees.length;
      const present = entityEmployees.filter((e) => {
        const s = e.dailySummaries[0]?.status;
        return s && ["PRESENT", "LATE", "HALF_DAY"].includes(s);
      }).length;
      const absent = total - present;
      const late = entityEmployees.filter((e) => e.dailySummaries[0]?.status === "LATE").length;

      const emailHtml = buildEntityEmail({
        displayDate,
        entityName,
        totalEmployees: total,
        presentEmployees: present,
        absentEmployees: absent,
        lateEmployees: late,
        locationMap,
      });

      // Send to all SUPER_ADMINs
      const results = await Promise.allSettled(
        recipientEmails.map((addr) =>
          sendEmail({
            to: addr,
            subject: `📊 Daily Report — ${entityName} — ${displayDate}`,
            html: emailHtml,
          })
        )
      );

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        allResults.push({
          entity: entityName,
          email: recipientEmails[i],
          success: r.status === "fulfilled" && (r.value as { success: boolean }).success,
          error: r.status === "rejected"
            ? String(r.reason)
            : r.status === "fulfilled" && !(r.value as { success: boolean }).success
              ? JSON.stringify((r.value as { error?: unknown }).error)
              : null,
        });
      }
    }

    const successCount = allResults.filter((r) => r.success).length;
    console.log(`Daily summary: ${entityMap.size} entities, ${successCount}/${allResults.length} emails sent`);

    return apiResponse({
      message: "Daily summary sent (entity-wise)",
      date: yesterdayStr,
      entitiesSent: entityMap.size,
      recipients: allResults,
    });
  } catch (error) {
    console.error("Daily summary cron error:", error);
    return apiError("Internal server error", 500);
  }
}

// ─── Email Builder (per entity) ──────────────────────────────

interface EntityEmailData {
  displayDate: string;
  entityName: string;
  totalEmployees: number;
  presentEmployees: number;
  absentEmployees: number;
  lateEmployees: number;
  locationMap: Map<string, {
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
}

function buildEntityEmail(data: EntityEmailData): string {
  const { displayDate, entityName, totalEmployees, presentEmployees, absentEmployees, lateEmployees, locationMap } = data;
  const presentPct = totalEmployees > 0 ? Math.round((presentEmployees / totalEmployees) * 100) : 0;

  let locationSections = "";

  for (const [, loc] of locationMap) {
    const locPresent = loc.employees.filter((e) => {
      const s = e.dailySummaries[0]?.status;
      return s && ["PRESENT", "LATE", "HALF_DAY"].includes(s);
    }).length;
    const locAbsent = loc.employees.length - locPresent;

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

      const statusColor: Record<string, string> = {
        PRESENT: "#16a34a",
        LATE: "#f59e0b",
        HALF_DAY: "#f97316",
        ABSENT: "#dc2626",
        ON_LEAVE: "#8b5cf6",
      };

      empRows += `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">
            ${emp.name}${emp.employeeCode ? ` <span style="color:#94a3b8;font-size:11px;">(${emp.employeeCode})</span>` : ""}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">${emp.department?.name || "—"}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;">
            <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:${statusColor[status] || "#6b7280"};">${status.replace("_", " ")}</span>
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;text-align:center;">${firstIn}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;text-align:center;">${lastOut}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;text-align:center;">${workHrs}</td>
        </tr>`;
    }

    locationSections += `
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

  return `
    <h2 style="color:#1e293b;margin:0 0 4px;">📊 Daily Attendance Report</h2>
    <p style="color:#64748b;margin:0 0 4px;font-size:14px;">${displayDate}</p>
    <p style="color:#1e40af;margin:0 0 20px;font-size:15px;font-weight:700;">🏢 ${entityName}</p>

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

    <!-- Location Breakdown -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tr style="background:#f8fafc;">
        <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Employee</td>
        <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Dept</td>
        <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Status</td>
        <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Check In</td>
        <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Check Out</td>
        <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Work Hrs</td>
      </tr>
      ${locationSections}
    </table>

    <p style="color:#94a3b8;font-size:12px;margin-top:20px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://attendease.nationalgroupindia.com"}/dashboard/admin-reports" style="color:#3b82f6;text-decoration:none;font-weight:600;">
        View Full Report in App →
      </a>
    </p>
  `;
}
