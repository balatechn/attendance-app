import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { LeavesClient } from "./leaves-client";

export const dynamic = "force-dynamic";

export default async function LeavesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const userId = session.user.id;
  const year = new Date().getFullYear();
  const canApprove = hasPermission(role, "leave:approve");
  const canViewAll = hasPermission(role, "leave:view-all");

  // Entity-based visibility: only SUPER_ADMIN sees all entities
  const isSuperAdmin = role === "SUPER_ADMIN";
  const userEntityId = session.user.entityId;

  // Determine requests filter
  let requestsWhere: Record<string, unknown> = {};
  if (canViewAll) {
    // Show all (entity filter applied below)
  } else if (canApprove) {
    requestsWhere = {
      OR: [
        { userId },
        { user: { managerId: userId } },
      ],
    };
  } else {
    requestsWhere = { userId };
  }

  // Apply entity filter for non-SUPER_ADMIN who can view-all or approve
  if (!isSuperAdmin && userEntityId && (canViewAll || canApprove)) {
    if (canViewAll && !requestsWhere.OR) {
      requestsWhere.user = { ...(requestsWhere.user as object || {}), entityId: userEntityId };
    }
  }

  const [leaveTypes, requests, balances] = await Promise.all([
    prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: requestsWhere,
      include: {
        user: { select: { id: true, name: true, email: true } },
        leaveType: { select: { name: true, code: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.leaveBalance.findMany({
      where: { userId, year },
      include: { leaveType: { select: { name: true, code: true } } },
    }),
  ]);

  return (
    <LeavesClient
      currentUserId={userId}
      canApprove={canApprove}
      leaveTypes={leaveTypes.map((lt) => ({
        id: lt.id,
        name: lt.name,
        code: lt.code,
        isFixed: lt.isFixed,
        defaultDays: lt.defaultDays,
        accrualPerMonth: lt.accrualPerMonth,
      }))}
      requests={requests.map((r) => ({
        id: r.id,
        userId: r.user.id,
        userName: r.user.name,
        leaveType: r.leaveType.name,
        leaveCode: r.leaveType.code,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        days: r.days,
        reason: r.reason,
        status: r.status,
        approverName: r.approver?.name || null,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt.toISOString(),
      }))}
      balances={balances.map((b) => ({
        id: b.id,
        leaveType: b.leaveType.name,
        leaveCode: b.leaveType.code,
        allocated: b.allocated,
        used: b.used,
        pending: b.pending,
        available: b.allocated - b.used - b.pending,
      }))}
    />
  );
}
