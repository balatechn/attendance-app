import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

/**
 * POST /api/leaves/types/seed — Seed default leave types (CL, SL, CO)
 * Only creates types that don't already exist (safe to call multiple times).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const defaultLeaveTypes = [
      {
        name: "Casual Leave",
        code: "CL",
        isFixed: true,
        defaultDays: 12,
        accrualPerMonth: null,
        minAdvanceNoticeDays: 3,
        certRequiredAfterDays: null,
        maxExpiryDays: null,
        carryForward: false,
        maxCarryForwardDays: 0,
      },
      {
        name: "Sick Leave",
        code: "SL",
        isFixed: true,
        defaultDays: 6,
        accrualPerMonth: null,
        minAdvanceNoticeDays: 0,
        certRequiredAfterDays: 2,
        maxExpiryDays: null,
        carryForward: false,
        maxCarryForwardDays: 0,
      },
      {
        name: "Compensatory Off",
        code: "CO",
        isFixed: false,
        defaultDays: 0,
        accrualPerMonth: null,
        minAdvanceNoticeDays: 1,
        certRequiredAfterDays: null,
        maxExpiryDays: 60,
        carryForward: false,
        maxCarryForwardDays: 0,
      },
    ];

    const created: string[] = [];
    const skipped: string[] = [];

    for (const lt of defaultLeaveTypes) {
      const existing = await prisma.leaveType.findFirst({
        where: { OR: [{ code: lt.code }, { name: lt.name }] },
      });

      if (existing) {
        // Update existing with new policy fields
        await prisma.leaveType.update({
          where: { id: existing.id },
          data: {
            defaultDays: lt.defaultDays,
            isFixed: lt.isFixed,
            minAdvanceNoticeDays: lt.minAdvanceNoticeDays,
            certRequiredAfterDays: lt.certRequiredAfterDays,
            maxExpiryDays: lt.maxExpiryDays,
            carryForward: lt.carryForward,
            maxCarryForwardDays: lt.maxCarryForwardDays,
          },
        });
        skipped.push(`${lt.name} (${lt.code}) — updated policy fields`);
      } else {
        await prisma.leaveType.create({ data: lt });
        created.push(`${lt.name} (${lt.code})`);
      }
    }

    return apiResponse({ created, skipped });
  } catch (error) {
    console.error("Leave types seed error:", error);
    return apiError("Internal server error", 500);
  }
}
