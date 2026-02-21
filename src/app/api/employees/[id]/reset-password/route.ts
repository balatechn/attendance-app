import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";

function generateTempPassword(length = 10): string {
  const chars =
    "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "users:manage")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user) {
      return apiError("Employee not found", 404);
    }

    if (!user.isActive) {
      return apiError("Cannot reset password for inactive employee", 400);
    }

    // Generate new temp password
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
      },
    });

    // Send password reset email
    await sendEmail({
      to: user.email,
      subject: "Password Reset - National Group India AttendEase",
      html: `
        <h2 style="color:#1e293b;margin:0 0 16px;">Password Reset</h2>
        <p style="color:#475569;line-height:1.6;">
          Hi <strong>${user.name}</strong>, your password has been reset by an administrator.
          Use the new temporary password below to log in.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:120px;">Email</td><td style="padding:8px 12px;">${user.email}</td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;">New Password</td><td style="padding:8px 12px;font-family:monospace;font-size:16px;letter-spacing:1px;">${tempPassword}</td></tr>
        </table>
        <p style="color:#dc2626;font-weight:600;">
          You will be required to change your password on next login.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/login" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
          Login Now
        </a>
      `,
    });

    return apiResponse({
      tempPassword, // Return to admin in case email fails
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return apiError("Failed to reset password", 500);
  }
}
