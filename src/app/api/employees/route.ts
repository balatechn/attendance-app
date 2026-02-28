import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";

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

function generateTempPassword(length = 10): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const role = session.user.role as Role;
    if (!hasPermission(role, "users:manage")) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const { name, email, phone, role: employeeRole, departmentId, entityId, locationId, shiftId, employeeCode, managerId } = body;

    if (!name || !email) {
      return apiError("Name and email are required", 400);
    }

    if (!phone || !phone.trim()) {
      return apiError("Phone number is required", 400);
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return apiError("An employee with this email already exists", 400);
    }

    // Check employee code uniqueness
    if (employeeCode) {
      const existingCode = await prisma.user.findUnique({ where: { employeeCode } });
      if (existingCode) {
        return apiError("Employee code already in use", 400);
      }
    }

    // Generate temp password
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Resolve shift: use provided, or fall back to default shift
    let resolvedShiftId = shiftId || null;
    if (!resolvedShiftId) {
      const defaultShift = await prisma.shift.findFirst({ where: { isDefault: true, isActive: true } });
      if (defaultShift) resolvedShiftId = defaultShift.id;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone || null,
        role: employeeRole || "EMPLOYEE",
        departmentId: departmentId || null,
        entityId: entityId || null,
        locationId: locationId || null,
        shiftId: resolvedShiftId,
        employeeCode: employeeCode || null,
        managerId: managerId || null,
        mustChangePassword: true,
        isActive: true,
      },
      include: { department: { select: { name: true } } },
    });

    // Send welcome email with temp password
    await sendEmail({
      to: email,
      subject: "Welcome to National Group India AttendEase",
      html: `
        <h2 style="color:#1e293b;margin:0 0 16px;">Welcome, ${name}!</h2>
        <p style="color:#475569;line-height:1.6;">
          Your account has been created on <strong>National Group India AttendEase</strong>.
          Use the credentials below to log in.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:120px;">Email</td><td style="padding:8px 12px;">${email}</td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;">Temp Password</td><td style="padding:8px 12px;font-family:monospace;font-size:16px;letter-spacing:1px;">${tempPassword}</td></tr>
        </table>
        <p style="color:#dc2626;font-weight:600;">
          You will be required to change your password on first login.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/login" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
          Login Now
        </a>
      `,
    });

    return apiResponse(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department?.name || null,
        tempPassword, // Return to admin so they can share if email fails
      },
      201
    );
  } catch (error) {
    console.error("Create employee error:", error);
    return apiError("Failed to create employee", 500);
  }
}
