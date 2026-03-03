import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { phone, designation, departmentId, entityId, locationId } = body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        phone: phone?.trim() || null,
        designation: designation?.trim() || null,
        departmentId: departmentId || null,
        entityId: entityId || null,
        locationId: locationId || null,
      },
      include: {
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        entity: { select: { id: true, name: true } },
      },
    });

    return apiResponse({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      designation: user.designation,
      departmentId: user.departmentId,
      department: user.department ? { name: user.department.name } : null,
      locationId: user.locationId,
      location: user.location ? { name: user.location.name } : null,
      entityId: user.entityId,
      entity: user.entity ? { name: user.entity.name } : null,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return apiError("Failed to update profile", 500);
  }
}
