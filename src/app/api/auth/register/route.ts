import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";

// POST: Register a new user after email verification
export async function POST(request: NextRequest) {
  try {
    const { email, name, password, code, phone, locationId } = await request.json();

    // Validate required fields
    if (!email || !name || !password || !code) {
      return apiError("All fields are required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit
    if (!checkRateLimit(`register:${normalizedEmail}`, 5, 600_000)) {
      return apiError("Too many attempts. Please try again later.", 429);
    }

    // Validate password strength
    if (password.length < 6) {
      return apiError("Password must be at least 6 characters", 400);
    }

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return apiError("An account with this email already exists", 409);
    }

    // Verify the code
    const verification = await prisma.verificationCode.findFirst({
      where: {
        email: normalizedEmail,
        code: code.toString().trim(),
        verified: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      return apiError("Invalid or expired verification code", 400);
    }

    // Mark code as verified
    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: { verified: true },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        password: hashedPassword,
        phone: phone?.trim() || null,
        locationId: locationId || null,
        role: "EMPLOYEE",
        isActive: true,
        mustChangePassword: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Cleanup: delete used verification codes
    await prisma.verificationCode.deleteMany({
      where: { email: normalizedEmail },
    });

    // Send welcome email
    await sendEmail({
      to: normalizedEmail,
      subject: "Welcome to National Group India AttendEase",
      html: `
        <div style="padding:20px 0;">
          <h2 style="color:#1e293b;margin-bottom:8px;">Welcome, ${user.name}! 🎉</h2>
          <p style="color:#64748b;margin-bottom:16px;">
            Your account has been created successfully. You can now sign in with your email and password.
          </p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:16px;">
            <p style="margin:0;color:#334155;"><strong>Email:</strong> ${user.email}</p>
          </div>
          <p style="color:#64748b;font-size:13px;">
            If you didn't create this account, please contact your administrator immediately.
          </p>
        </div>
      `,
    });

    return apiResponse(
      { message: "Account created successfully", userId: user.id },
      201
    );
  } catch (error) {
    console.error("Registration error:", error);
    return apiError("Registration failed", 500);
  }
}
