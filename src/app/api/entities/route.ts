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
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const entities = await prisma.entity.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });

    return apiResponse(entities);
  } catch (error) {
    console.error("Entities GET error:", error);
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

    const { name, code, address } = await request.json();
    if (!name || !code) return apiError("Name and code are required", 400);

    const existing = await prisma.entity.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) return apiError("Entity with this name or code already exists", 400);

    const entity = await prisma.entity.create({
      data: { name, code: code.toUpperCase(), address: address || null },
    });

    return apiResponse(entity, 201);
  } catch (error) {
    console.error("Entities POST error:", error);
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

    const { id, name, code, address, isActive } = await request.json();
    if (!id) return apiError("ID is required", 400);

    const entity = await prisma.entity.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(address !== undefined && { address }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return apiResponse(entity);
  } catch (error) {
    console.error("Entities PUT error:", error);
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
    if (!id) return apiError("ID is required", 400);

    const userCount = await prisma.user.count({ where: { entityId: id } });
    if (userCount > 0) {
      return apiError(`Cannot delete: ${userCount} employees are assigned to this entity`, 400);
    }

    await prisma.entity.delete({ where: { id } });
    return apiResponse({ message: "Deleted" });
  } catch (error) {
    console.error("Entities DELETE error:", error);
    return apiError("Internal server error", 500);
  }
}
