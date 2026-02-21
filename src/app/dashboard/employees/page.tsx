import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { EmployeesClient } from "./employees-client";
import type { Role } from "@/generated/prisma/enums";

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

  const employees = await prisma.user.findMany({
    where,
    include: { department: true },
    orderBy: { name: "asc" },
  });

  return (
    <EmployeesClient
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        role: e.role,
        department: e.department ? { name: e.department.name } : null,
        isActive: e.isActive,
      }))}
    />
  );
}
