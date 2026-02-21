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

  const where = hasPermission(role, "attendance:view-all")
    ? {}
    : { managerId: session.user.id };

  const { start, end } = getDayRange(new Date());

  const employees = await prisma.user.findMany({
    where,
    include: {
      department: true,
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
  });

  return (
    <EmployeesClient
      employees={employees.map((e) => {
        const sessionCount = e.sessions.length;
        const isWorking = sessionCount > 0 && sessionCount % 2 !== 0;
        const lastCheckIn = isWorking
          ? e.sessions.filter((s) => s.type === "CHECK_IN").pop()?.timestamp
          : null;
        const summary = e.dailySummaries[0] || null;

        return {
          id: e.id,
          name: e.name,
          email: e.email,
          role: e.role,
          department: e.department ? { name: e.department.name } : null,
          isActive: e.isActive,
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

