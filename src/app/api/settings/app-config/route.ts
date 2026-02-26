import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

/**
 * GET /api/settings/app-config
 * Returns all app config key-value pairs as an object.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const configs = await prisma.appConfig.findMany();
    const result: Record<string, string> = {};
    for (const c of configs) {
      result[c.key] = c.value;
    }

    return apiResponse(result);
  } catch (error) {
    console.error("Get app config error:", error);
    return apiError("Failed to load settings", 500);
  }
}

/**
 * PUT /api/settings/app-config
 * Upserts one or more config keys. Body: { configs: { key: value, ... } }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const { configs } = body as { configs: Record<string, string> };

    if (!configs || typeof configs !== "object") {
      return apiError("Invalid config data");
    }

    // Upsert each config key
    const updates = Object.entries(configs).map(([key, value]) =>
      prisma.appConfig.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    );

    await Promise.all(updates);

    return apiResponse({ message: "Settings saved" });
  } catch (error) {
    console.error("Update app config error:", error);
    return apiError("Failed to save settings", 500);
  }
}
