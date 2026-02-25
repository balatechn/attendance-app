import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const shifts = await prisma.shift.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });

    return apiResponse(shifts);
  } catch (error) {
    console.error("Shifts GET error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { name, code, startTime, endTime, graceMinutes, standardWorkMins, isDefault } =
      await request.json();

    if (!name || !code || !startTime || !endTime) {
      return apiError("Name, code, start time, and end time are required", 400);
    }

    // Validate time format HH:mm
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return apiError("Invalid time format. Use HH:mm (e.g., 09:00)", 400);
    }

    const existing = await prisma.shift.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) return apiError("Shift with this name or code already exists", 400);

    // If this shift is default, unset other defaults
    if (isDefault) {
      await prisma.shift.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const shift = await prisma.shift.create({
      data: {
        name,
        code: code.toUpperCase(),
        startTime,
        endTime,
        graceMinutes: graceMinutes ?? 10,
        standardWorkMins: standardWorkMins ?? 480,
        isDefault: isDefault ?? false,
      },
    });

    return apiResponse(shift, 201);
  } catch (error) {
    console.error("Shifts POST error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id, name, code, startTime, endTime, graceMinutes, standardWorkMins, isActive, isDefault } =
      await request.json();

    if (!id) return apiError("Shift ID is required", 400);

    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) return apiError("Shift not found", 404);

    // Check name/code uniqueness (excluding current)
    if (name || code) {
      const duplicate = await prisma.shift.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: [name ? { name } : {}, code ? { code } : {}].filter((o) => Object.keys(o).length > 0) },
          ],
        },
      });
      if (duplicate) return apiError("Another shift with this name or code already exists", 400);
    }

    // If setting as default, unset others
    if (isDefault) {
      await prisma.shift.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Validate time format if provided
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (startTime && !timeRegex.test(startTime)) {
      return apiError("Invalid start time format. Use HH:mm", 400);
    }
    if (endTime && !timeRegex.test(endTime)) {
      return apiError("Invalid end time format. Use HH:mm", 400);
    }

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(graceMinutes !== undefined && { graceMinutes }),
        ...(standardWorkMins !== undefined && { standardWorkMins }),
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return apiResponse(shift);
  } catch (error) {
    console.error("Shifts PUT error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await request.json();
    if (!id) return apiError("Shift ID is required", 400);

    // Check if employees are assigned to this shift
    const assignedCount = await prisma.user.count({ where: { shiftId: id } });
    if (assignedCount > 0) {
      return apiError(
        `Cannot delete shift: ${assignedCount} employee(s) are currently assigned to it. Reassign them first.`,
        400
      );
    }

    await prisma.shift.delete({ where: { id } });

    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Shifts DELETE error:", error);
    return apiError("Internal server error", 500);
  }
}
