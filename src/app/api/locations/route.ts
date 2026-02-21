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

    const locations = await prisma.location.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });

    return apiResponse(
      locations.map((l) => ({
        id: l.id,
        name: l.name,
        code: l.code,
        address: l.address,
        isActive: l.isActive,
        userCount: l._count.users,
        createdAt: l.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Locations GET error:", error);
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

    const { name, code, address } = await request.json();

    if (!name || !code) {
      return apiError("Name and code are required");
    }

    const existing = await prisma.location.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) {
      return apiError("A location with this name or code already exists");
    }

    const location = await prisma.location.create({
      data: { name, code: code.toUpperCase(), address: address || null },
    });

    return apiResponse(location, 201);
  } catch (error) {
    console.error("Locations POST error:", error);
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

    const { id, name, code, address, isActive } = await request.json();
    if (!id) return apiError("Location ID is required");

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code.toUpperCase();
    if (address !== undefined) data.address = address || null;
    if (isActive !== undefined) data.isActive = isActive;

    const location = await prisma.location.update({
      where: { id },
      data,
    });

    return apiResponse(location);
  } catch (error) {
    console.error("Locations PUT error:", error);
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
    if (!id) return apiError("Location ID is required");

    const location = await prisma.location.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!location) return apiError("Location not found", 404);
    if (location._count.users > 0) {
      return apiError("Cannot delete a location with assigned employees. Deactivate it instead.");
    }

    await prisma.location.delete({ where: { id } });
    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Locations DELETE error:", error);
    return apiError("Internal server error", 500);
  }
}
