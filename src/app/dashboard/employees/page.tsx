import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { EmployeesClient } from "./employees-client";
import type { Role } from "@/generated/prisma/enums";
import { getDayRange } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "attendance:view-all") && !hasPermission(role, "attendance:view-team")) {
    redirect("/dashboard");
  }

  const canManageUsers = hasPermission(role, "users:manage");

  const where = hasPermission(role, "attendance:view-all")
    ? {}
    : { managerId: session.user.id };

  const { start, end } = getDayRange(new Date());

  const [employees, departments, entities, locations, shifts, managers] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        department: true,
        entity: true,
        location: true,
        shift: { select: { name: true } },
        manager: { select: { name: true } },
        sessions: {
          where: { timestamp: { gte: start, lte: end } },
          orderBy: { timestamp: "asc" },
        },
        dailySummaries: {
          where: { date: { gte: start, lte: end } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    canManageUsers ? prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canManageUsers ? prisma.entity.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canManageUsers ? prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true, entityId: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canManageUsers ? prisma.shift.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canManageUsers ? prisma.user.findMany({
      where: { role: { in: ["MANAGER", "HR_ADMIN", "MANAGEMENT", "ADMIN", "SUPER_ADMIN"] }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }) : Promise.resolve([]),
  ]);

  return (
    <EmployeesClient
      canManageUsers={canManageUsers}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      entities={entities.map((e) => ({ id: e.id, name: e.name }))}
      locations={locations.map((l) => ({ id: l.id, name: l.name, entityId: l.entityId }))}
      shifts={shifts.map((s) => ({ id: s.id, name: s.name }))}
      managers={managers.map((m) => ({ id: m.id, name: m.name }))}
      employees={employees.map((e) => {
        const sessionCount = e.sessions.length;
        const isManagement = e.role === "MANAGEMENT";
        const isWorking = isManagement ? true : (sessionCount > 0 && sessionCount % 2 !== 0);
        const lastCheckIn = isWorking && !isManagement
          ? e.sessions.filter((s) => s.type === "CHECK_IN").pop()?.timestamp
          : null;
        const summary = e.dailySummaries[0] || null;

        return {
          id: e.id,
          name: e.name,
          email: e.email,
          phone: e.phone,
          employeeCode: e.employeeCode,
          role: e.role,
          departmentId: e.departmentId,
          entityId: e.entityId,
          locationId: e.locationId,
          managerId: e.managerId,
          shiftId: e.shiftId,
          department: e.department ? { name: e.department.name } : null,
          entity: e.entity ? { name: e.entity.name } : null,
          location: e.location ? { name: e.location.name } : null,
          shift: e.shift ? { name: e.shift.name } : null,
          reportingTo: e.manager?.name || null,
          isActive: e.isActive,
          geofenceEnabled: e.geofenceEnabled,
          isWorking,
          lastCheckIn: lastCheckIn?.toISOString() || null,
          todaySessions: sessionCount,
          totalWorkMins: summary?.totalWorkMins ?? 0,
          firstCheckIn: summary?.firstCheckIn?.toISOString() || null,
          lastCheckOut: summary?.lastCheckOut?.toISOString() || null,
        };
      })}
    />
  );
}

