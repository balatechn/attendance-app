import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isManagerOrAbove } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { ManagementDashboardClient } from "./management-client";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!isManagerOrAbove(role)) {
    redirect("/dashboard");
  }

  return <ManagementDashboardClient />;
}
