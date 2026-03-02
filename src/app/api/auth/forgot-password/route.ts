import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import { sendEmail } from "@/lib/email";

// POST: Send password reset code to registered email
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return apiError("Email is required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: max 3 codes per email per 10 min
    if (!checkRateLimit(`reset:${normalizedEmail}`, 3, 600_000)) {
      return apiError("Too many attempts. Please try again later.", 429);
    }

    // Validate user exists in database
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, isActive: true },
    });

    if (!user) {
      // Return generic message to prevent email enumeration
      return apiResponse({ message: "If an account exists with this email, a reset code has been sent." });
    }

    if (!user.isActive) {
      return apiError("This account has been deactivated. Please contact your administrator.", 403);
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any previous codes for this email
    await prisma.verificationCode.deleteMany({
      where: { email: normalizedEmail },
    });

    // Create new code
    await prisma.verificationCode.create({
      data: {
        email: normalizedEmail,
        code,
        expiresAt,
      },
    });

    // Send email with reset code
    const result = await sendEmail({
      to: normalizedEmail,
      subject: "Password Reset Code",
      html: `
        <div style="text-align:center;padding:20px 0;">
          <h2 style="color:#1e293b;margin-bottom:8px;">Reset Your Password</h2>
          <p style="color:#64748b;margin-bottom:8px;">
            Hi <strong>${user.name}</strong>,
          </p>
          <p style="color:#64748b;margin-bottom:24px;">
            We received a request to reset your password. Use the code below:
          </p>
          <div style="background:#f1f5f9;border-radius:12px;padding:20px;display:inline-block;margin-bottom:24px;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e40af;">
              ${code}
            </span>
          </div>
          <p style="color:#94a3b8;font-size:13px;">
            This code expires in <strong>10 minutes</strong>.<br/>
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `,
    });

    if (!result.success) {
      return apiError("Failed to send reset email. Please try again.", 500);
    }

    return apiResponse({ message: "If an account exists with this email, a reset code has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return apiError("Failed to process request", 500);
  }
}
