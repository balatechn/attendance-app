import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { sendEmail } from "@/lib/email";
import { differenceInCalendarDays } from "date-fns";
import { formatIST } from "@/lib/datetime";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    // Determine which requests to show
    let where: Record<string, unknown> = {};

    if (hasPermission(role, "leave:view-all")) {
      // HR/Admin can see all (entity filter below)
      if (status) where.status = status;
    } else if (hasPermission(role, "leave:approve")) {
      // Managers see their team's and their own
      where = {
        OR: [
          { userId: session.user.id },
          { user: { managerId: session.user.id } },
        ],
      };
      if (status) where.status = status;
    } else {
      // Employees see only their own
      where = { userId: session.user.id };
      if (status) where.status = status;
    }

    // Entity-based visibility: only SUPER_ADMIN sees all entities
    if (role !== "SUPER_ADMIN" && session.user.entityId && hasPermission(role, "leave:view-all")) {
      where.user = { ...(where.user as object || {}), entityId: session.user.entityId };
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        leaveType: { select: { name: true, code: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Get balances for the current user
    const balances = await prisma.leaveBalance.findMany({
      where: { userId: session.user.id, year: parseInt(year) },
      include: { leaveType: { select: { name: true, code: true } } },
    });

    return apiResponse({ requests, balances });
  } catch (error) {
    console.error("Leaves GET error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    if (!checkRateLimit(`leave:${session.user.id}`, 10, 60_000)) {
      return apiError("Too many requests", 429);
    }

    const { leaveTypeId, startDate, endDate, reason } = await request.json();

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return apiError("Leave type, dates, and reason are required");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return apiError("End date cannot be before start date");
    }

    const days = differenceInCalendarDays(end, start) + 1;

    // Check leave type exists
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      return apiError("Invalid leave type");
    }

    // Check balance
    const year = start.getFullYear();
    let balance = await prisma.leaveBalance.findFirst({
      where: { userId: session.user.id, leaveTypeId, year },
    });

    // Auto-create balance if not exists
    if (!balance) {
      const allocated = leaveType.isFixed
        ? leaveType.defaultDays
        : (leaveType.accrualPerMonth || 0) * new Date().getMonth(); // months elapsed

      balance = await prisma.leaveBalance.create({
        data: {
          userId: session.user.id,
          leaveTypeId,
          year,
          allocated,
          used: 0,
          pending: 0,
        },
      });
    }

    const available = balance.allocated - balance.used - balance.pending;
    if (days > available) {
      return apiError(`Insufficient leave balance. Available: ${available} days, Requested: ${days} days`);
    }

    // Check overlapping leave requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (overlapping) {
      return apiError("You already have a leave request for overlapping dates");
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId: session.user.id,
        leaveTypeId,
        startDate: start,
        endDate: end,
        days,
        reason,
      },
    });

    // Update pending balance
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: { increment: days } },
    });

    // Notify manager
    const employee = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { manager: true },
    });

    if (employee?.manager) {
      await prisma.notification.create({
        data: {
          userId: employee.manager.id,
          title: "Leave Request",
          message: `${employee.name} requested ${leaveType.name} (${days} day${days > 1 ? "s" : ""}) from ${formatIST(start, "MMM dd")} to ${formatIST(end, "MMM dd, yyyy")}`,
          link: "/dashboard/leaves",
        },
      });

      try {
        await sendEmail({
          to: employee.manager.email,
          subject: `Leave Request - ${employee.name}`,
          html: `
            <h2 style="color:#1e293b;margin:0 0 16px;">Leave Request</h2>
            <p style="color:#475569;line-height:1.6;">
              <strong>${employee.name}</strong> has submitted a leave request.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:120px;">Type</td><td style="padding:8px 12px;">${leaveType.name}</td></tr>
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;">From</td><td style="padding:8px 12px;">${formatIST(start, "MMM dd, yyyy")}</td></tr>
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;">To</td><td style="padding:8px 12px;">${formatIST(end, "MMM dd, yyyy")}</td></tr>
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;">Days</td><td style="padding:8px 12px;">${days}</td></tr>
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;">Reason</td><td style="padding:8px 12px;">${reason}</td></tr>
            </table>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/dashboard/leaves" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
              Review Request
            </a>
          `,
        });
      } catch (emailError) {
        console.error("Leave email failed:", emailError);
      }
    }

    return apiResponse({ id: leaveRequest.id, status: "PENDING" }, 201);
  } catch (error) {
    console.error("Leave request error:", error);
    return apiError("Internal server error", 500);
  }
}
