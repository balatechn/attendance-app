import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "attendance:view-team") && !hasPermission(role, "attendance:view-all")) {
      return apiError("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("department");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { isActive: true };

    // Managers can only see their team
    if (!hasPermission(role, "attendance:view-all")) {
      where.managerId = session.user.id;
    }

    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const employees = await prisma.user.findMany({
      where,
      include: { department: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 100,
    });

    return apiResponse(
      employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        role: e.role,
        department: e.department?.name || null,
      }))
    );
  } catch (error) {
    console.error("Employees error:", error);
    return apiError("Internal server error", 500);
  }
}
