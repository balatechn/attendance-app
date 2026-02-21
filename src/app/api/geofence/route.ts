import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    if (!hasPermission(session.user.role as Role, "geofence:manage")) {
      return apiError("Forbidden", 403);
    }

    const geoFences = await prisma.geoFence.findMany({
      orderBy: { createdAt: "desc" },
    });

    return apiResponse(geoFences);
  } catch (error) {
    console.error("Geofence GET error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    if (!hasPermission(session.user.role as Role, "geofence:manage")) {
      return apiError("Forbidden", 403);
    }

    const { name, latitude, longitude, radiusM } = await request.json();

    if (!name || typeof latitude !== "number" || typeof longitude !== "number") {
      return apiError("Name, latitude, and longitude are required");
    }

    const geoFence = await prisma.geoFence.create({
      data: {
        name,
        latitude,
        longitude,
        radiusM: radiusM || 200,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "GeoFence",
        entityId: geoFence.id,
        metadata: JSON.stringify({ name, latitude, longitude, radiusM }),
      },
    });

    return apiResponse(geoFence, 201);
  } catch (error) {
    console.error("Geofence POST error:", error);
    return apiError("Internal server error", 500);
  }
}
