import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { GeofenceClient } from "./geofence-client";
import type { Role } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default async function GeofencePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!hasPermission(session.user.role as Role, "geofence:manage")) {
    redirect("/dashboard");
  }

  const geoFences = await prisma.geoFence.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <GeofenceClient
      geoFences={geoFences.map((g) => ({
        id: g.id,
        name: g.name,
        latitude: g.latitude,
        longitude: g.longitude,
        radiusM: g.radiusM,
        isActive: g.isActive,
      }))}
    />
  );
}
