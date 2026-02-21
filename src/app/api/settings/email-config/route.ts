import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import nodemailer from "nodemailer";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const config = await prisma.emailConfig.findFirst({ where: { isActive: true } });
    if (!config) return apiResponse(null);

    return apiResponse({
      ...config,
      password: "••••••••", // mask password
    });
  } catch (error) {
    console.error("Email config GET error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { provider, host, port, secure, username, password, fromName, fromEmail } = await request.json();

    if (!host || !username || !password || !fromEmail) {
      return apiError("Host, username, password, and from email are required", 400);
    }

    // Deactivate existing configs
    await prisma.emailConfig.updateMany({ data: { isActive: false } });

    const config = await prisma.emailConfig.create({
      data: {
        provider: provider || "custom",
        host,
        port: Number(port) || 587,
        secure: secure || false,
        username,
        password,
        fromName: fromName || "National Group India AttendEase",
        fromEmail,
        isActive: true,
      },
    });

    return apiResponse({ ...config, password: "••••••••" }, 201);
  } catch (error) {
    console.error("Email config POST error:", error);
    return apiError("Internal server error", 500);
  }
}

// Test email connection
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { host, port, secure, username, password } = await request.json();

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: secure || false,
      auth: { user: username, pass: password },
      connectionTimeout: 10000,
    });

    await transporter.verify();
    return apiResponse({ message: "Connection successful!" });
  } catch (error) {
    console.error("Email test error:", error);
    const message = error instanceof Error ? error.message : "Connection failed";
    return apiError(`Connection failed: ${message}`, 400);
  }
}
