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

// Send a real test email
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden", 403);
    }

    const { host, port, secure, username, password, fromName, fromEmail, testTo } = await request.json();

    if (!host || !username || !password || !fromEmail || !testTo) {
      return apiError("All fields including test recipient email are required", 400);
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: secure || false,
      auth: { user: username, pass: password },
      connectionTimeout: 15000,
    });

    await transporter.sendMail({
      from: `${fromName || "AttendEase"} <${fromEmail}>`,
      to: testTo,
      subject: "AttendEase - Test Email ✓",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">✓ Email Service Working</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              This is a test email from <strong>AttendEase</strong> to confirm your SMTP configuration is working correctly.
            </p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0; font-size: 13px; color: #6b7280;"><strong>SMTP Host:</strong> ${host}</p>
              <p style="margin: 4px 0; font-size: 13px; color: #6b7280;"><strong>Port:</strong> ${port}</p>
              <p style="margin: 4px 0; font-size: 13px; color: #6b7280;"><strong>From:</strong> ${fromEmail}</p>
              <p style="margin: 4px 0; font-size: 13px; color: #6b7280;"><strong>Sent at:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
              National Group India — AttendEase
            </p>
          </div>
        </div>
      `,
    });

    return apiResponse({ message: `Test email sent to ${testTo}` });
  } catch (error) {
    console.error("Send test email error:", error);
    const message = error instanceof Error ? error.message : "Failed to send";
    return apiError(`Failed to send test email: ${message}`, 400);
  }
}
