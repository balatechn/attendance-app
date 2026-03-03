import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

/**
 * GET /api/leaves/balance?year=2026&userId=xxx
 *
 * - Employees see only their own balances
 * - Management/Admin/SuperAdmin see any employee's balances
 * - If no userId provided + admin → returns all employees' balances grouped
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const userId = searchParams.get("userId");

    const canManage = hasPermission(role, "leave:balance-manage");

    // If requesting a specific user
    if (userId) {
      // Only self or admin can view
      if (userId !== session.user.id && !canManage) {
        return apiError("Forbidden", 403);
      }

      const balances = await prisma.leaveBalance.findMany({
        where: { userId, year },
        include: {
          leaveType: { select: { name: true, code: true, isFixed: true, defaultDays: true, accrualPerMonth: true } },
        },
        orderBy: { leaveType: { name: "asc" } },
      });

      return apiResponse({ balances });
    }

    // If admin wants all employees
    if (canManage) {
      // Build entity filter
      const isSuperAdmin = role === "SUPER_ADMIN";
      const userEntityId = session.user.entityId;

      const userWhere: Record<string, unknown> = { isActive: true };
      if (!isSuperAdmin && userEntityId) {
        userWhere.entityId = userEntityId;
      }

      const employees = await prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          employeeCode: true,
          entity: { select: { name: true } },
          department: { select: { name: true } },
          leaveBalances: {
            where: { year },
            include: {
              leaveType: { select: { name: true, code: true, isFixed: true, defaultDays: true, accrualPerMonth: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return apiResponse({ employees, year });
    }

    // Employee: own balances
    const balances = await prisma.leaveBalance.findMany({
      where: { userId: session.user.id, year },
      include: {
        leaveType: { select: { name: true, code: true, isFixed: true, defaultDays: true, accrualPerMonth: true } },
      },
      orderBy: { leaveType: { name: "asc" } },
    });

    return apiResponse({ balances });
  } catch (error) {
    console.error("Leave balance GET error:", error);
    return apiError("Internal server error", 500);
  }
}

/**
 * PUT /api/leaves/balance
 * Body: { userId, leaveTypeId, year, adjustment, reason }
 *
 * adjustment > 0 = credit leaves, adjustment < 0 = deduct leaves
 * Only MANAGEMENT/ADMIN/SUPER_ADMIN can use this.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "leave:balance-manage")) {
      return apiError("Forbidden", 403);
    }

    const { userId, leaveTypeId, year, adjustment, reason } = await request.json();

    if (!userId || !leaveTypeId || !year || adjustment === undefined || adjustment === 0) {
      return apiError("userId, leaveTypeId, year, and non-zero adjustment are required");
    }

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!user) return apiError("Employee not found", 404);

    // Validate leave type exists
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType) return apiError("Leave type not found", 404);

    // Find or create balance
    let balance = await prisma.leaveBalance.findFirst({
      where: { userId, leaveTypeId, year },
    });

    if (!balance) {
      balance = await prisma.leaveBalance.create({
        data: {
          userId,
          leaveTypeId,
          year,
          allocated: 0,
          used: 0,
          pending: 0,
        },
      });
    }

    const newAllocated = balance.allocated + adjustment;
    if (newAllocated < 0) {
      return apiError(`Cannot reduce allocation below 0. Current: ${balance.allocated}, Adjustment: ${adjustment}`);
    }

    // Check that new allocation doesn't go below used + pending
    const minRequired = balance.used + balance.pending;
    if (newAllocated < minRequired) {
      return apiError(
        `Cannot reduce allocation below used (${balance.used}) + pending (${balance.pending}) = ${minRequired}`
      );
    }

    // Update balance
    const updated = await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { allocated: newAllocated },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: adjustment > 0 ? "LEAVE_BALANCE_CREDIT" : "LEAVE_BALANCE_DEBIT",
        entity: "LeaveBalance",
        entityId: updated.id,
        metadata: JSON.stringify({
          employeeId: userId,
          employeeName: user.name,
          leaveType: leaveType.name,
          year,
          adjustment,
          newAllocated,
          reason: reason || null,
        }),
      },
    });

    // Notify employee
    const action = adjustment > 0 ? "credited" : "deducted";
    await prisma.notification.create({
      data: {
        userId,
        title: `Leave Balance ${adjustment > 0 ? "Credited" : "Deducted"}`,
        message: `${Math.abs(adjustment)} day(s) of ${leaveType.name} have been ${action}. New balance: ${newAllocated - updated.used - updated.pending} available.`,
        link: "/dashboard/leaves",
      },
    });

    return apiResponse({
      id: updated.id,
      allocated: updated.allocated,
      used: updated.used,
      pending: updated.pending,
      available: updated.allocated - updated.used - updated.pending,
    });
  } catch (error) {
    console.error("Leave balance PUT error:", error);
    return apiError("Internal server error", 500);
  }
}
