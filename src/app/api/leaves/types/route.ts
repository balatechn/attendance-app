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

    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: "asc" },
    });

    return apiResponse(leaveTypes);
  } catch (error) {
    console.error("Leave types GET error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { name, code, isFixed, defaultDays, accrualPerMonth } = await request.json();

    if (!name || !code) {
      return apiError("Name and code are required");
    }

    const existing = await prisma.leaveType.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) {
      return apiError("A leave type with this name or code already exists");
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        name,
        code: code.toUpperCase(),
        isFixed: isFixed ?? true,
        defaultDays: defaultDays ?? 0,
        accrualPerMonth: accrualPerMonth ?? null,
      },
    });

    return apiResponse(leaveType, 201);
  } catch (error) {
    console.error("Leave types POST error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id, name, code, isFixed, defaultDays, accrualPerMonth, isActive } = await request.json();
    if (!id) return apiError("Leave type ID is required");

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code.toUpperCase();
    if (isFixed !== undefined) data.isFixed = isFixed;
    if (defaultDays !== undefined) data.defaultDays = defaultDays;
    if (accrualPerMonth !== undefined) data.accrualPerMonth = accrualPerMonth;
    if (isActive !== undefined) data.isActive = isActive;

    const leaveType = await prisma.leaveType.update({
      where: { id },
      data,
    });

    return apiResponse(leaveType);
  } catch (error) {
    console.error("Leave types PUT error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await request.json();
    if (!id) return apiError("Leave type ID is required");

    const leaveType = await prisma.leaveType.findUnique({
      where: { id },
      include: { _count: { select: { requests: true } } },
    });

    if (!leaveType) return apiError("Leave type not found", 404);
    if (leaveType._count.requests > 0) {
      return apiError("Cannot delete a leave type with existing requests. Deactivate it instead.");
    }

    await prisma.leaveType.delete({ where: { id } });
    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Leave types DELETE error:", error);
    return apiError("Internal server error", 500);
  }
}
