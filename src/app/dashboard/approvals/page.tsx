import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ApprovalsClient } from "./approvals-client";
import type { Role } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "regularization:approve")) {
    redirect("/dashboard");
  }

  // Get pending regularizations for the user's team or all
  const isSuperAdmin = role === "SUPER_ADMIN";
  const userEntityId = session.user.entityId;

  const where: Record<string, unknown> = { status: "PENDING" };
  if (!hasPermission(role, "regularization:view-all")) {
    where.employee = { managerId: session.user.id };
  }
  // Entity-based visibility: only SUPER_ADMIN sees all entities
  if (!isSuperAdmin && userEntityId) {
    where.employee = { ...(where.employee as object || {}), entityId: userEntityId };
  }

  const regularizations = await prisma.regularization.findMany({
    where,
    include: {
      employee: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ApprovalsClient
      regularizations={regularizations.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        type: r.type,
        reason: r.reason,
        status: r.status,
        reviewNote: r.reviewNote || undefined,
        employee: r.employee,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
