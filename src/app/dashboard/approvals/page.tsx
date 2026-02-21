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
  const where = hasPermission(role, "regularization:view-all")
    ? { status: "PENDING" as const }
    : {
        status: "PENDING" as const,
        employee: { managerId: session.user.id },
      };

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
