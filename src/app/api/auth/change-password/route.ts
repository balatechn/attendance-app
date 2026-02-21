import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword || newPassword.length < 8) {
      return apiError("New password must be at least 8 characters", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) return apiError("User not found", 404);

    // If user must change password (first login), current password is the temp one
    if (currentPassword) {
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return apiError("Current password is incorrect", 400);
      }
    } else if (!user.mustChangePassword) {
      return apiError("Current password is required", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    return apiResponse({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return apiError("Failed to change password", 500);
  }
}
