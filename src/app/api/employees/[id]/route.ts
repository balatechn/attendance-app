import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "users:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      email,
      phone,
      role: employeeRole,
      departmentId,
      entityId,
      locationId,
      shiftId,
      employeeCode,
      managerId,
      isActive,
    } = body;

    if (!name || !email) {
      return apiError("Name and email are required", 400);
    }

    // Check employee exists
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Employee not found", 404);
    }

    // Check email uniqueness (excluding current user)
    if (email.toLowerCase() !== existing.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (emailTaken) {
        return apiError("An employee with this email already exists", 400);
      }
    }

    // Check employee code uniqueness (excluding current user)
    if (employeeCode && employeeCode !== existing.employeeCode) {
      const codeTaken = await prisma.user.findUnique({
        where: { employeeCode },
      });
      if (codeTaken) {
        return apiError("Employee code already in use", 400);
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        role: employeeRole || existing.role,
        departmentId: departmentId || null,
        entityId: entityId || null,
        locationId: locationId || null,
        shiftId: shiftId || null,
        employeeCode: employeeCode || null,
        managerId: managerId || null,
        isActive: typeof isActive === "boolean" ? isActive : existing.isActive,
      },
      include: { department: { select: { name: true } } },
    });

    return apiResponse({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department?.name || null,
    });
  } catch (error) {
    console.error("Update employee error:", error);
    return apiError("Failed to update employee", 500);
  }
}
