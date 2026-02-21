import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import { sendEmail, regularizationRequestEmail } from "@/lib/email";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    if (!checkRateLimit(`reg:${session.user.id}`, 5, 60_000)) {
      return apiError("Too many requests", 429);
    }

    const { date, type, reason, requestedTime } = await request.json();

    if (!date || !type || !reason) {
      return apiError("Date, type, and reason are required");
    }

    if (!["MISSED_CHECK_IN", "MISSED_CHECK_OUT", "WRONG_TIME"].includes(type)) {
      return apiError("Invalid regularization type");
    }

    // Check if already submitted for same date and type
    const existing = await prisma.regularization.findFirst({
      where: {
        employeeId: session.user.id,
        date: new Date(date),
        type,
        status: "PENDING",
      },
    });

    if (existing) {
      return apiError("A pending request already exists for this date and type");
    }

    const regularization = await prisma.regularization.create({
      data: {
        employeeId: session.user.id,
        date: new Date(date),
        type,
        reason,
        requestedTime: requestedTime ? new Date(requestedTime) : null,
      },
    });

    // Create notification for manager
    const employee = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { manager: true },
    });

    if (employee?.manager) {
      await prisma.notification.create({
        data: {
          userId: employee.manager.id,
          title: "Regularization Request",
          message: `${employee.name} requested attendance regularization for ${format(new Date(date), "MMM dd, yyyy")}`,
          link: "/dashboard/approvals",
        },
      });

      // Send email to manager
      try {
        await sendEmail({
          to: employee.manager.email,
          subject: `Attendance Regularization Request - ${employee.name}`,
          html: regularizationRequestEmail(
            employee.name,
            format(new Date(date), "MMM dd, yyyy"),
            type.replace(/_/g, " "),
            reason
          ),
        });
      } catch (emailError) {
        console.error("Email send failed:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Regularization",
        entityId: regularization.id,
        metadata: JSON.stringify({ date, type, reason }),
      },
    });

    return apiResponse({ id: regularization.id, status: "PENDING" }, 201);
  } catch (error) {
    console.error("Regularization error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { employeeId: session.user.id };
    if (status) where.status = status;

    const regularizations = await prisma.regularization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiResponse(
      regularizations.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        type: r.type,
        reason: r.reason,
        status: r.status,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Get regularizations error:", error);
    return apiError("Internal server error", 500);
  }
}
