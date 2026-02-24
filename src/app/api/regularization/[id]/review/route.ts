import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import { sendEmail, regularizationStatusEmail } from "@/lib/email";
import { formatIST } from "@/lib/datetime";
import type { Role } from "@/generated/prisma/enums";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "regularization:approve")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await params;
    const { action, reviewNote } = await request.json();

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return apiError("Invalid action");
    }

    const regularization = await prisma.regularization.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!regularization) return apiError("Not found", 404);
    if (regularization.status !== "PENDING") {
      return apiError("Already reviewed");
    }

    // Verify approver has access (manager can only approve their team)
    if (!hasPermission(role, "regularization:view-all")) {
      if (regularization.employee.managerId !== session.user.id) {
        return apiError("Forbidden", 403);
      }
    }

    // Update regularization
    const updated = await prisma.regularization.update({
      where: { id },
      data: {
        status: action,
        approverId: session.user.id,
        reviewNote: reviewNote || null,
      },
    });

    // If approved, update attendance record
    if (action === "APPROVED") {
      const dateStart = new Date(regularization.date);
      dateStart.setHours(0, 0, 0, 0);

      if (regularization.type === "MISSED_CHECK_IN" && regularization.requestedTime) {
        await prisma.attendanceSession.create({
          data: {
            userId: regularization.employeeId,
            type: "CHECK_IN",
            timestamp: regularization.requestedTime,
            latitude: 0,
            longitude: 0,
            address: "Regularized",
          },
        });
      } else if (regularization.type === "MISSED_CHECK_OUT" && regularization.requestedTime) {
        await prisma.attendanceSession.create({
          data: {
            userId: regularization.employeeId,
            type: "CHECK_OUT",
            timestamp: regularization.requestedTime,
            latitude: 0,
            longitude: 0,
            address: "Regularized",
          },
        });
      }
    }

    // Notify employee
    await prisma.notification.create({
      data: {
        userId: regularization.employeeId,
        title: `Regularization ${action === "APPROVED" ? "Approved" : "Rejected"}`,
        message: `Your request for ${formatIST(regularization.date, "MMM dd, yyyy")} has been ${action.toLowerCase()}.`,
        link: "/dashboard/regularization",
      },
    });

    // Send email to employee
    try {
      await sendEmail({
        to: regularization.employee.email,
        subject: `Regularization ${action === "APPROVED" ? "Approved" : "Rejected"}`,
        html: regularizationStatusEmail(
          action as "APPROVED" | "REJECTED",
          formatIST(regularization.date, "MMM dd, yyyy"),
          reviewNote
        ),
      });
    } catch (emailError) {
      console.error("Email send failed:", emailError);
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `REGULARIZATION_${action}`,
        entity: "Regularization",
        entityId: id,
        metadata: JSON.stringify({
          employeeId: regularization.employeeId,
          action,
          reviewNote,
        }),
      },
    });

    return apiResponse({ id: updated.id, status: updated.status });
  } catch (error) {
    console.error("Review error:", error);
    return apiError("Internal server error", 500);
  }
}
