import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import { sendEmail } from "@/lib/email";

// POST: Send verification code to email
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return apiError("Email is required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: max 3 codes per email per 10 min
    if (!checkRateLimit(`verify:${normalizedEmail}`, 3, 600_000)) {
      return apiError("Too many attempts. Please try again later.", 429);
    }

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return apiError(
        "An account with this email already exists. Please sign in.",
        409
      );
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

    // Send email
    const result = await sendEmail({
      to: normalizedEmail,
      subject: "Your Verification Code",
      html: `
        <div style="text-align:center;padding:20px 0;">
          <h2 style="color:#1e293b;margin-bottom:8px;">Verify Your Email</h2>
          <p style="color:#64748b;margin-bottom:24px;">
            Enter the following code to complete your registration:
          </p>
          <div style="background:#f1f5f9;border-radius:12px;padding:20px;display:inline-block;margin-bottom:24px;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e40af;">
              ${code}
            </span>
          </div>
          <p style="color:#94a3b8;font-size:13px;">
            This code expires in <strong>10 minutes</strong>.<br/>
            If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
    });

    if (!result.success) {
      return apiError("Failed to send verification email. Please try again.", 500);
    }

    return apiResponse({ message: "Verification code sent" });
  } catch (error) {
    console.error("Send verification code error:", error);
    return apiError("Failed to send verification code", 500);
  }
}
