import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDayRange } from "@/lib/datetime";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { AttendancePageClient } from "./attendance-client";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const role = session.user.role as Role;
  const currentUserId = session.user.id;
  const canViewTeam = hasPermission(role, "attendance:view-team") || hasPermission(role, "attendance:view-all");

  // Determine which user's attendance to show
  let targetUserId = currentUserId;
  if (params.employee && canViewTeam) {
    // Validate the selected employee is within viewable scope
    if (hasPermission(role, "attendance:view-all")) {
      targetUserId = params.employee;
    } else if (hasPermission(role, "attendance:view-team")) {
      // Manager can only view direct reports
      const isDirectReport = await prisma.user.count({
        where: { id: params.employee, managerId: currentUserId },
      });
      if (isDirectReport > 0) {
        targetUserId = params.employee;
      }
    }
  }

  const { start, end } = getDayRange(new Date());

  // Fetch attendance data + team list in parallel
  const [sessions, recentSummaries, teamMembers] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: {
        userId: targetUserId,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: "asc" },
    }),
    prisma.dailySummary.findMany({
      where: { userId: targetUserId },
      orderBy: { date: "desc" },
      take: 7,
    }),
    canViewTeam
      ? (() => {
          const teamWhere: Record<string, unknown> = { isActive: true };
          if (!hasPermission(role, "attendance:view-all")) {
            teamWhere.managerId = currentUserId;
          }
          // Entity-based visibility: only SUPER_ADMIN sees all entities
          if (role !== "SUPER_ADMIN" && session.user.entityId) {
            teamWhere.entityId = session.user.entityId;
          }
          return prisma.user.findMany({
            where: teamWhere,
            select: {
              id: true,
              name: true,
              email: true,
              department: { select: { name: true } },
            },
            orderBy: { name: "asc" },
          });
        })()
      : Promise.resolve([]),
  ]);

  // Get selected employee name
  const selectedEmployee = targetUserId !== currentUserId
    ? teamMembers.find((e) => e.id === targetUserId)
    : null;

  return (
    <AttendancePageClient
      sessions={sessions.map((s) => ({
        id: s.id,
        type: s.type,
        timestamp: s.timestamp.toISOString(),
        latitude: s.latitude,
        longitude: s.longitude,
        address: s.address || null,
      }))}
      recentDays={recentSummaries.map((d) => ({
        date: d.date.toISOString(),
        status: d.status,
        totalWorkMins: d.totalWorkMins,
        firstCheckIn: d.firstCheckIn?.toISOString() || null,
        lastCheckOut: d.lastCheckOut?.toISOString() || null,
      }))}
      teamMembers={teamMembers.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        department: e.department,
      }))}
      selectedEmployeeId={targetUserId !== currentUserId ? targetUserId : null}
      selectedEmployeeName={selectedEmployee?.name || null}
      canViewTeam={canViewTeam}
    />
  );
}
