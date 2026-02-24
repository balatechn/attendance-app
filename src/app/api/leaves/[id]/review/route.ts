import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { sendEmail } from "@/lib/email";
import { formatIST } from "@/lib/datetime";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "leave:approve")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await params;
    const { status, reviewNote } = await request.json();

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return apiError("Invalid status. Must be APPROVED or REJECTED");
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: true,
        leaveType: true,
      },
    });

    if (!leaveRequest) return apiError("Leave request not found", 404);
    if (leaveRequest.status !== "PENDING") {
      return apiError("This request has already been processed");
    }

    // Verify manager has authority (must be user's manager or admin)
    if (!hasPermission(role, "leave:view-all")) {
      const employee = await prisma.user.findUnique({
        where: { id: leaveRequest.userId },
        select: { managerId: true },
      });
      if (employee?.managerId !== session.user.id) {
        return apiError("You can only approve/reject your team's requests", 403);
      }
    }

    // Update request
    await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approverId: session.user.id,
        reviewNote: reviewNote || null,
      },
    });

    // Update balance
    const year = leaveRequest.startDate.getFullYear();
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        userId: leaveRequest.userId,
        leaveTypeId: leaveRequest.leaveTypeId,
        year,
      },
    });

    if (balance) {
      if (status === "APPROVED") {
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: { decrement: leaveRequest.days },
            used: { increment: leaveRequest.days },
          },
        });
      } else {
        // REJECTED - release pending
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: { decrement: leaveRequest.days },
          },
        });
      }
    }

    // Notify employee
    await prisma.notification.create({
      data: {
        userId: leaveRequest.userId,
        title: `Leave ${status === "APPROVED" ? "Approved" : "Rejected"}`,
        message: `Your ${leaveRequest.leaveType.name} request (${formatIST(leaveRequest.startDate, "MMM dd")} - ${formatIST(leaveRequest.endDate, "MMM dd")}) has been ${status.toLowerCase()}.`,
        link: "/dashboard/leaves",
      },
    });

    // Send email to employee
    try {
      const color = status === "APPROVED" ? "#16a34a" : "#dc2626";
      await sendEmail({
        to: leaveRequest.user.email,
        subject: `Leave ${status === "APPROVED" ? "Approved" : "Rejected"} - ${leaveRequest.leaveType.name}`,
        html: `
          <h2 style="color:#1e293b;margin:0 0 16px;">Leave ${status === "APPROVED" ? "Approved" : "Rejected"}</h2>
          <p style="color:#475569;line-height:1.6;">
            Your <strong>${leaveRequest.leaveType.name}</strong> request for
            <strong>${formatIST(leaveRequest.startDate, "MMM dd, yyyy")}</strong> to
            <strong>${formatIST(leaveRequest.endDate, "MMM dd, yyyy")}</strong>
            (${leaveRequest.days} day${leaveRequest.days > 1 ? "s" : ""}) has been
            <span style="color:${color};font-weight:600;">${status.toLowerCase()}</span>.
          </p>
          ${reviewNote ? `<p style="color:#475569;"><strong>Note:</strong> ${reviewNote}</p>` : ""}
          <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/dashboard/leaves" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
            View Details
          </a>
        `,
      });
    } catch (emailError) {
      console.error("Leave status email failed:", emailError);
    }

    return apiResponse({ id, status });
  } catch (error) {
    console.error("Leave review error:", error);
    return apiError("Internal server error", 500);
  }
}
