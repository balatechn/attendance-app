import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";

/**
 * Yearly leave balance reset — runs on Jan 1 at 00:30 IST.
 * 
 * For each active employee and each active leave type:
 * - Creates new balance for the new year
 * - Pro-rata for employees who joined this year
 * - No carry forward (as per policy)
 * 
 * GET /api/cron/leave-reset           → runs the reset
 * GET /api/cron/leave-reset?test=true → dry run (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isTest = searchParams.get("test") === "true";

    if (!isTest) {
      const authHeader = request.headers.get("authorization");
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return apiError("Unauthorized", 401);
      }
    }

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

    const year = new Date().getFullYear();

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: { isActive: true, role: { not: "MANAGEMENT" } },
      select: { id: true, createdAt: true },
    });

    // Get all active fixed leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true, isFixed: true },
    });

    let created = 0;
    let skipped = 0;

    for (const emp of employees) {
      for (const lt of leaveTypes) {
        // Check if balance already exists for this year
        const existing = await prisma.leaveBalance.findFirst({
          where: { userId: emp.id, leaveTypeId: lt.id, year },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Pro-rata for new joinees
        let allocated = lt.defaultDays;
        const joinYear = emp.createdAt.getFullYear();
        if (joinYear === year) {
          const joinMonth = emp.createdAt.getMonth();
          const remainingMonths = 12 - joinMonth;
          allocated = Math.round((lt.defaultDays * remainingMonths / 12) * 2) / 2;
        }

        // No carry forward as per policy
        if (!isTest) {
          await prisma.leaveBalance.create({
            data: {
              userId: emp.id,
              leaveTypeId: lt.id,
              year,
              allocated,
              used: 0,
              pending: 0,
            },
          });
        }
        created++;
      }
    }

    console.log(`Leave balance reset for ${year}: ${created} created, ${skipped} skipped${isTest ? " (DRY RUN)" : ""}`);

    return apiResponse({
      message: isTest ? "Dry run complete (no changes made)" : "Leave balances reset",
      year,
      employees: employees.length,
      leaveTypes: leaveTypes.length,
      balancesCreated: created,
      balancesSkipped: skipped,
    });
  } catch (error) {
    console.error("Leave reset cron error:", error);
    return apiError("Internal server error", 500);
  }
}
