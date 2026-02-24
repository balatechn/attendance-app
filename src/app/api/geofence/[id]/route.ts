import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "geofence:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const { name, latitude, longitude, radiusM, isActive } = body;

    const existing = await prisma.geoFence.findUnique({ where: { id } });
    if (!existing) return apiError("Geofence not found", 404);

    const updated = await prisma.geoFence.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(typeof latitude === "number" && { latitude }),
        ...(typeof longitude === "number" && { longitude }),
        ...(typeof radiusM === "number" && { radiusM }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "GeoFence",
        entityId: id,
        metadata: JSON.stringify(body),
      },
    });

    return apiResponse(updated);
  } catch (error) {
    console.error("Geofence PATCH error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "geofence:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await params;

    const existing = await prisma.geoFence.findUnique({ where: { id } });
    if (!existing) return apiError("Geofence not found", 404);

    await prisma.geoFence.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "GeoFence",
        entityId: id,
        metadata: JSON.stringify({ name: existing.name }),
      },
    });

    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("Geofence DELETE error:", error);
    return apiError("Internal server error", 500);
  }
}
