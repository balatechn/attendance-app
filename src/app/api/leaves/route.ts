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

    const { leaveTypeId, startDate, endDate, reason, certNote } = await request.json();

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

    // ── Policy: Advance notice check ──
    if (leaveType.minAdvanceNoticeDays && leaveType.minAdvanceNoticeDays > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const noticeDays = differenceInCalendarDays(start, today);
      if (noticeDays < leaveType.minAdvanceNoticeDays) {
        return apiError(
          `${leaveType.name} requires at least ${leaveType.minAdvanceNoticeDays} days advance notice. You are applying ${noticeDays} day(s) before.`
        );
      }
    }

    // ── Policy: Medical certificate note for SL > N days ──
    if (leaveType.certRequiredAfterDays && days > leaveType.certRequiredAfterDays) {
      if (!certNote || !certNote.trim()) {
        return apiError(
          `${leaveType.name} for more than ${leaveType.certRequiredAfterDays} days requires a medical certificate note. Please provide certificate details.`
        );
      }
    }

    // ── Policy: Comp Off expiry check ──
    if (leaveType.maxExpiryDays && leaveType.maxExpiryDays > 0) {
      // For comp off, check that balance was allocated within the expiry window
      // The start date of the leave must be within maxExpiryDays from when the comp off was earned
      // Since we don't track earn date separately, we check if the leave start is reasonable
      const today = new Date();
      const maxStartDate = new Date(today);
      maxStartDate.setDate(maxStartDate.getDate() + leaveType.maxExpiryDays);
      if (start > maxStartDate) {
        return apiError(
          `${leaveType.name} must be used within ${leaveType.maxExpiryDays} days. Please apply for a date within the allowed window.`
        );
      }
    }

    // Check balance
    const year = start.getFullYear();
    let balance = await prisma.leaveBalance.findFirst({
      where: { userId: session.user.id, leaveTypeId, year },
    });

    // Auto-create balance if not exists (with pro-rata for new joinees)
    if (!balance) {
      let allocated = 0;

      if (leaveType.isFixed) {
        // Pro-rata calculation based on join date
        const employee = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { createdAt: true },
        });

        const joinDate = employee?.createdAt || new Date();
        const joinYear = joinDate.getFullYear();

        if (joinYear === year) {
          // New joinee this year: pro-rata from join month to Dec
          const joinMonth = joinDate.getMonth(); // 0-indexed (0 = Jan)
          const remainingMonths = 12 - joinMonth;
          allocated = Math.round((leaveType.defaultDays * remainingMonths / 12) * 2) / 2; // round to nearest 0.5
        } else {
          // Full allocation for employees who joined in previous years
          allocated = leaveType.defaultDays;
        }
      } else {
        // Accrual-based (e.g., comp off) — starts at 0, admin grants manually
        allocated = 0;
      }

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
        certNote: certNote?.trim() || null,
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
      include: { manager: true, location: true },
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
              ${employee.designation ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:120px;">Designation</td><td style="padding:8px 12px;">${employee.designation}</td></tr>` : ''}
              ${employee.location ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:120px;">Location</td><td style="padding:8px 12px;">${employee.location.name}</td></tr>` : ''}
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
