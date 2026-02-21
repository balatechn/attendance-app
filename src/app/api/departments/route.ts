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
    if (!hasPermission(session.user.role as Role, "departments:manage")) {
      return apiError("Forbidden", 403);
    }

    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });

    return apiResponse(departments);
  } catch (error) {
    console.error("Departments GET error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "departments:manage")) {
      return apiError("Forbidden", 403);
    }

    const { name, code } = await request.json();
    if (!name || !code) return apiError("Name and code are required", 400);

    const existing = await prisma.department.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) return apiError("Department with this name or code already exists", 400);

    const department = await prisma.department.create({
      data: { name, code: code.toUpperCase() },
    });

    return apiResponse(department, 201);
  } catch (error) {
    console.error("Departments POST error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "departments:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id, name, code, isActive } = await request.json();
    if (!id) return apiError("ID is required", 400);

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return apiResponse(department);
  } catch (error) {
    console.error("Departments PUT error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "departments:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await request.json();
    if (!id) return apiError("ID is required", 400);

    // Check if department has users
    const userCount = await prisma.user.count({ where: { departmentId: id } });
    if (userCount > 0) {
      return apiError(`Cannot delete: ${userCount} employees are assigned to this department`, 400);
    }

    await prisma.department.delete({ where: { id } });
    return apiResponse({ message: "Deleted" });
  } catch (error) {
    console.error("Departments DELETE error:", error);
    return apiError("Internal server error", 500);
  }
}
