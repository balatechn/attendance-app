import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

/**
 * GET  /api/reports/daily-email?date=2026-03-02
 *   → Return entity-wise daily attendance data as JSON (for in-app rendering).
 *
 * POST /api/reports/daily-email
 *   → Trigger daily summary email for a specific date (calls the cron logic).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "reports:view-all")) {
      return apiError("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    if (!dateStr) return apiError("Date param required (?date=YYYY-MM-DD)", 400);

    const dayStart = new Date(`${dateStr}T00:00:00+05:30`);
    const dayEnd = new Date(`${dateStr}T23:59:59+05:30`);
    const displayDate = formatInTimeZone(dayStart, IST, "EEEE, MMMM d, yyyy");

    // Fetch employees with attendance
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
          select: { type: true, timestamp: true },
        },
        dailySummaries: {
          where: { date: { gte: dayStart, lte: dayEnd } },
          select: { status: true, totalWorkMins: true, firstCheckIn: true, lastCheckOut: true, overtimeMins: true },
        },
      },
      orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
    });

    // Group by entity → location
    const entitiesMap = new Map<string, {
      entityId: string;
      entityName: string;
      locations: Map<string, {
        locationId: string;
        locationName: string;
        employees: Array<{
          id: string;
          name: string;
          employeeCode: string | null;
          department: string;
          status: string;
          firstCheckIn: string | null;
          lastCheckOut: string | null;
          workHours: string;
          overtimeMins: number;
        }>;
      }>;
    }>();

    for (const emp of employees) {
      const eKey = emp.entity?.id || "unassigned";
      const eName = emp.entity?.name || "Unassigned Entity";
      const lKey = emp.location?.id || "unassigned";
      const lName = emp.location?.name || "Unassigned Location";

      if (!entitiesMap.has(eKey)) {
        entitiesMap.set(eKey, { entityId: eKey, entityName: eName, locations: new Map() });
      }
      const ent = entitiesMap.get(eKey)!;
      if (!ent.locations.has(lKey)) {
        ent.locations.set(lKey, { locationId: lKey, locationName: lName, employees: [] });
      }

      const summary = emp.dailySummaries[0];
      const status = summary?.status || "ABSENT";
      const firstIn = summary?.firstCheckIn
        ? formatInTimeZone(new Date(summary.firstCheckIn), IST, "hh:mm a")
        : null;
      const lastOut = summary?.lastCheckOut
        ? formatInTimeZone(new Date(summary.lastCheckOut), IST, "hh:mm a")
        : null;
      const mins = summary?.totalWorkMins || 0;
      const workHours = mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : "—";

      ent.locations.get(lKey)!.employees.push({
        id: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        department: emp.department?.name || "—",
        status,
        firstCheckIn: firstIn,
        lastCheckOut: lastOut,
        workHours,
        overtimeMins: summary?.overtimeMins || 0,
      });
    }

    // Convert to serializable array
    const entities = Array.from(entitiesMap.values()).map((ent) => {
      const locations = Array.from(ent.locations.values());
      const allEmps = locations.flatMap((l) => l.employees);
      const present = allEmps.filter((e) => ["PRESENT", "LATE", "HALF_DAY"].includes(e.status)).length;
      const late = allEmps.filter((e) => e.status === "LATE").length;
      return {
        entityId: ent.entityId,
        entityName: ent.entityName,
        total: allEmps.length,
        present,
        absent: allEmps.length - present,
        late,
        locations: locations.map((loc) => {
          const lPresent = loc.employees.filter((e) => ["PRESENT", "LATE", "HALF_DAY"].includes(e.status)).length;
          return {
            locationId: loc.locationId,
            locationName: loc.locationName,
            total: loc.employees.length,
            present: lPresent,
            absent: loc.employees.length - lPresent,
            employees: loc.employees,
          };
        }),
      };
    });

    // Overall stats
    const total = employees.length;
    const present = employees.filter((e) => {
      const s = e.dailySummaries[0]?.status;
      return s && ["PRESENT", "LATE", "HALF_DAY"].includes(s);
    }).length;

    return apiResponse({
      date: dateStr,
      displayDate,
      stats: {
        total,
        present,
        absent: total - present,
        late: employees.filter((e) => e.dailySummaries[0]?.status === "LATE").length,
      },
      entities,
    });
  } catch (error) {
    console.error("Daily email report data error:", error);
    return apiError("Internal server error", 500);
  }
}

/**
 * POST /api/reports/daily-email { date: "2026-03-02" }
 *   → Triggers the daily summary email for the given date to SUPER_ADMIN.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "reports:view-all")) {
      return apiError("Forbidden", 403);
    }

    const { date } = await request.json();
    if (!date) return apiError("date is required", 400);

    // Import and call the email builder from daily-summary cron
    // Instead of duplicating, we just call the cron endpoint internally with the same logic
    const { sendEmail } = await import("@/lib/email");

    const dayStart = new Date(`${date}T00:00:00+05:30`);
    const dayEnd = new Date(`${date}T23:59:59+05:30`);
    const displayDate = formatInTimeZone(dayStart, IST, "EEEE, MMMM d, yyyy");

    const employees = await prisma.user.findMany({
      where: { isActive: true, role: { not: "MANAGEMENT" } },
      select: {
        id: true, name: true, email: true, employeeCode: true,
        entity: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        department: { select: { name: true } },
        shift: { select: { name: true, startTime: true, endTime: true } },
        sessions: {
          where: { timestamp: { gte: dayStart, lte: dayEnd } },
          orderBy: { timestamp: "asc" },
          select: { type: true, timestamp: true },
        },
        dailySummaries: {
          where: { date: { gte: dayStart, lte: dayEnd } },
          select: { status: true, totalWorkMins: true, firstCheckIn: true, lastCheckOut: true, overtimeMins: true },
        },
      },
      orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
    });

    // Group by entity
    const entityMap = new Map<string, { entityName: string; employees: typeof employees }>();
    for (const emp of employees) {
      const key = emp.entity?.id || "unassigned";
      const name = emp.entity?.name || "Unassigned Entity";
      if (!entityMap.has(key)) entityMap.set(key, { entityName: name, employees: [] });
      entityMap.get(key)!.employees.push(emp);
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
      select: { email: true },
    });

    if (admins.length === 0) return apiError("No admin recipients found", 404);

    const allResults: Array<{ entity: string; email: string; success: boolean }> = [];

    for (const [, { entityName, employees: entEmps }] of entityMap) {
      // Build location groups
      const locMap = new Map<string, { locationName: string; emps: typeof entEmps }>();
      for (const emp of entEmps) {
        const lk = emp.location?.id || "unassigned";
        const ln = emp.location?.name || "Unassigned Location";
        if (!locMap.has(lk)) locMap.set(lk, { locationName: ln, emps: [] });
        locMap.get(lk)!.emps.push(emp);
      }

      const total = entEmps.length;
      const present = entEmps.filter((e) => {
        const s = e.dailySummaries[0]?.status;
        return s && ["PRESENT", "LATE", "HALF_DAY"].includes(s);
      }).length;
      const late = entEmps.filter((e) => e.dailySummaries[0]?.status === "LATE").length;

      // Build simple HTML table
      let locSections = "";
      for (const [, loc] of locMap) {
        const lp = loc.emps.filter((e) => {
          const s = e.dailySummaries[0]?.status; return s && ["PRESENT", "LATE", "HALF_DAY"].includes(s);
        }).length;
        let rows = "";
        for (const emp of loc.emps) {
          const sm = emp.dailySummaries[0];
          const st = sm?.status || "ABSENT";
          const fin = sm?.firstCheckIn ? formatInTimeZone(new Date(sm.firstCheckIn), IST, "hh:mm a") : "—";
          const lot = sm?.lastCheckOut ? formatInTimeZone(new Date(sm.lastCheckOut), IST, "hh:mm a") : "—";
          const wh = sm ? `${Math.floor(sm.totalWorkMins / 60)}h ${sm.totalWorkMins % 60}m` : "—";
          const sc: Record<string, string> = { PRESENT: "#16a34a", LATE: "#f59e0b", HALF_DAY: "#f97316", ABSENT: "#dc2626", ON_LEAVE: "#8b5cf6" };
          rows += `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;">${emp.name}${emp.employeeCode ? ` <span style="color:#94a3b8;font-size:11px;">(${emp.employeeCode})</span>` : ""}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">${emp.department?.name || "—"}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;"><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:${sc[st] || "#6b7280"};">${st.replace("_", " ")}</span></td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:center;">${fin}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:center;">${lot}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:center;">${wh}</td>
          </tr>`;
        }
        locSections += `<tr><td colspan="6" style="padding:8px 10px;background:#f0f9ff;font-size:13px;font-weight:600;color:#0369a1;border-bottom:1px solid #bae6fd;">📍 ${loc.locationName} <span style="font-weight:400;color:#64748b;font-size:12px;margin-left:8px;">${lp} present · ${loc.emps.length - lp} absent · ${loc.emps.length} total</span></td></tr>${rows}`;
      }

      const html = `
        <h2 style="color:#1e293b;margin:0 0 4px;">📊 Daily Attendance Report</h2>
        <p style="color:#64748b;margin:0 0 4px;font-size:14px;">${displayDate}</p>
        <p style="color:#1e40af;margin:0 0 20px;font-size:15px;font-weight:700;">🏢 ${entityName}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="width:25%;padding:12px;background:#f0fdf4;border-radius:8px;text-align:center;"><div style="font-size:24px;font-weight:700;color:#16a34a;">${present}</div><div style="font-size:11px;color:#65a30d;text-transform:uppercase;font-weight:600;">Present</div></td>
            <td style="width:4px;"></td>
            <td style="width:25%;padding:12px;background:#fef2f2;border-radius:8px;text-align:center;"><div style="font-size:24px;font-weight:700;color:#dc2626;">${total - present}</div><div style="font-size:11px;color:#dc2626;text-transform:uppercase;font-weight:600;">Absent</div></td>
            <td style="width:4px;"></td>
            <td style="width:25%;padding:12px;background:#fffbeb;border-radius:8px;text-align:center;"><div style="font-size:24px;font-weight:700;color:#f59e0b;">${late}</div><div style="font-size:11px;color:#d97706;text-transform:uppercase;font-weight:600;">Late</div></td>
            <td style="width:4px;"></td>
            <td style="width:25%;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;"><div style="font-size:24px;font-weight:700;color:#334155;">${total}</div><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;">Total (${total > 0 ? Math.round((present / total) * 100) : 0}%)</div></td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <tr style="background:#f8fafc;">
            <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Employee</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Dept</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Status</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Check In</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Check Out</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center;">Work Hrs</td>
          </tr>
          ${locSections}
        </table>`;

      const results = await Promise.allSettled(
        admins.map((a) => sendEmail({ to: a.email, subject: `📊 Daily Report — ${entityName} — ${displayDate}`, html }))
      );
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        allResults.push({
          entity: entityName,
          email: admins[i].email,
          success: r.status === "fulfilled" && (r.value as { success: boolean }).success,
        });
      }
    }

    return apiResponse({
      message: "Daily report emails sent",
      date,
      sent: allResults.filter((r) => r.success).length,
      total: allResults.length,
      details: allResults,
    });
  } catch (error) {
    console.error("Send daily email report error:", error);
    return apiError("Internal server error", 500);
  }
}
