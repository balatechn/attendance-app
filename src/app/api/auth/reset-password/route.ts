import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import bcrypt from "bcryptjs";

// POST: Verify code and reset password
export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return apiError("Email, code, and new password are required", 400);
    }

    if (newPassword.length < 8) {
      return apiError("Password must be at least 8 characters", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: max 5 attempts per email per 10 min
    if (!checkRateLimit(`reset-verify:${normalizedEmail}`, 5, 600_000)) {
      return apiError("Too many attempts. Please try again later.", 429);
    }

    // Find valid verification code
    const verification = await prisma.verificationCode.findFirst({
      where: {
        email: normalizedEmail,
        code: code.trim(),
        expiresAt: { gt: new Date() },
        verified: false,
      },
    });

    if (!verification) {
      return apiError("Invalid or expired code. Please request a new one.", 400);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return apiError("Account not found or deactivated", 404);
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
        },
      }),
      // Mark code as used and clean up
      prisma.verificationCode.deleteMany({
        where: { email: normalizedEmail },
      }),
    ]);

    return apiResponse({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return apiError("Failed to reset password", 500);
  }
}
