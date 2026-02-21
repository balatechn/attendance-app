import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!hasPermission(session.user.role as Role, "settings:manage")) {
    redirect("/dashboard");
  }

  const [departments, entities, locations, leaveTypes, emailConfig] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.entity.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.location.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.leaveType.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.emailConfig.findFirst({ where: { isActive: true } }),
  ]);

  return (
    <SettingsClient
      departments={departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        isActive: d.isActive,
        userCount: d._count.users,
        createdAt: d.createdAt.toISOString(),
      }))}
      entities={entities.map((e) => ({
        id: e.id,
        name: e.name,
        code: e.code,
        address: e.address,
        isActive: e.isActive,
        userCount: e._count.users,
        createdAt: e.createdAt.toISOString(),
      }))}
      locations={locations.map((l) => ({
        id: l.id,
        name: l.name,
        code: l.code,
        address: l.address,
        isActive: l.isActive,
        userCount: l._count.users,
        createdAt: l.createdAt.toISOString(),
      }))}
      leaveTypes={leaveTypes.map((lt) => ({
        id: lt.id,
        name: lt.name,
        code: lt.code,
        isFixed: lt.isFixed,
        defaultDays: lt.defaultDays,
        accrualPerMonth: lt.accrualPerMonth,
        isActive: lt.isActive,
      }))}
      emailConfig={emailConfig ? {
        id: emailConfig.id,
        provider: emailConfig.provider,
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        username: emailConfig.username,
        fromName: emailConfig.fromName,
        fromEmail: emailConfig.fromEmail,
      } : null}
    />
  );
}
