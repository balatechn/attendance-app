import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import { haversineDistance } from "@/lib/geo";
import { reverseGeocode } from "@/lib/geocode";
import { getDayRange } from "@/lib/datetime";
import { sendEmail, movementAlertEmail } from "@/lib/email";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

// Track which users already got an alert today to avoid spam
const alertedToday = new Map<string, number>(); // userId -> last alert timestamp

function cleanupOldAlerts() {
  const now = Date.now();
  for (const [key, ts] of alertedToday.entries()) {
    if (now - ts > 3600_000) alertedToday.delete(key); // cleanup hourly entries
  }
}

// GET — Test movement alert (SUPER_ADMIN only)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.role as Role, "settings:manage")) {
      return apiError("Forbidden — only SUPER_ADMIN can test alerts", 403);
    }

    // Find all super admins
    const superAdmins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
      select: { email: true, name: true },
    });

    if (superAdmins.length === 0) {
      return apiError("No active SUPER_ADMIN users found in database", 404);
    }

    const testEmailHtml = movementAlertEmail(
      "Test Employee",
      "test@example.com",
      "09:15 AM",
      "Office Location, Sector 62, Noida",
      "Connaught Place, New Delhi",
      1250,
      "https://www.google.com/maps/dir/28.627235,77.376894/28.632735,77.219431"
    );

    const results = await Promise.allSettled(
      superAdmins.map((admin) =>
        sendEmail({
          to: admin.email,
          subject: `\u26a0\ufe0f TEST Movement Alert — Ignore this test email`,
          html: testEmailHtml,
        })
      )
    );

    const details = results.map((r, i) => ({
      email: superAdmins[i].email,
      success: r.status === "fulfilled" && (r.value as { success: boolean }).success,
      error: r.status === "rejected" ? String(r.reason) : (r.status === "fulfilled" && !(r.value as { success: boolean }).success ? JSON.stringify((r.value as { error?: unknown }).error) : null),
    }));

    console.log("Test movement alert results:", JSON.stringify(details));

    return apiResponse({
      message: "Test alert sent",
      recipients: details,
    });
  } catch (error) {
    console.error("Test movement alert error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    // Rate limit: max 2 pings per minute per user
    if (!checkRateLimit(`location-ping:${session.user.id}`, 2, 60_000)) {
      return apiResponse({ status: "rate_limited" });
    }

    const { latitude, longitude } = await request.json();
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return apiError("Invalid location data");
    }

    const userId = session.user.id;
    const { start, end } = getDayRange(new Date());

    // Check if movement alerts are enabled
    const [alertConfig, thresholdConfig] = await Promise.all([
      prisma.appConfig.findUnique({ where: { key: "MOVEMENT_ALERT_ENABLED" } }),
      prisma.appConfig.findUnique({ where: { key: "MOVEMENT_ALERT_DISTANCE" } }),
    ]);

    const alertEnabled = alertConfig?.value !== "false"; // enabled by default
    if (!alertEnabled) {
      return apiResponse({ status: "alerts_disabled" });
    }

    const thresholdM = parseInt(thresholdConfig?.value || "500", 10); // default 500m

    // Get today's first CHECK_IN
    const firstCheckIn = await prisma.attendanceSession.findFirst({
      where: { userId, type: "CHECK_IN", timestamp: { gte: start, lte: end } },
      orderBy: { timestamp: "asc" },
    });

    if (!firstCheckIn) {
      return apiResponse({ status: "no_checkin" });
    }

    // Check if user is still checked in (last session should be CHECK_IN)
    const lastSession = await prisma.attendanceSession.findFirst({
      where: { userId, timestamp: { gte: start, lte: end } },
      orderBy: { timestamp: "desc" },
    });

    if (!lastSession || lastSession.type !== "CHECK_IN") {
      return apiResponse({ status: "not_checked_in" });
    }

    // Calculate distance from check-in location
    const distance = Math.round(
      haversineDistance(
        firstCheckIn.latitude,
        firstCheckIn.longitude,
        latitude,
        longitude
      )
    );

    if (distance <= thresholdM) {
      return apiResponse({ status: "ok", distance });
    }

    // Employee has moved beyond threshold — check cooldown (1 alert per hour per user)
    cleanupOldAlerts();
    const lastAlert = alertedToday.get(userId);
    if (lastAlert && Date.now() - lastAlert < 3600_000) {
      return apiResponse({ status: "already_alerted", distance });
    }

    // Mark as alerted
    alertedToday.set(userId, Date.now());

    // Get employee info and super admins
    const [employee, superAdmins] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
        select: { email: true },
      }),
    ]);

    if (!employee || superAdmins.length === 0) {
      console.log(`Movement alert skipped: employee=${!!employee}, superAdmins=${superAdmins.length}`);
      return apiResponse({ status: "alert_skipped", distance });
    }

    // Reverse geocode current location (non-blocking fallback)
    const currentAddress = await reverseGeocode(latitude, longitude);
    const checkInAddress = firstCheckIn.address || `${firstCheckIn.latitude.toFixed(6)}, ${firstCheckIn.longitude.toFixed(6)}`;

    const checkInTime = firstCheckIn.timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

    // Google Maps link showing both points
    const mapUrl = `https://www.google.com/maps/dir/${firstCheckIn.latitude},${firstCheckIn.longitude}/${latitude},${longitude}`;

    const emailHtml = movementAlertEmail(
      employee.name,
      employee.email,
      checkInTime,
      checkInAddress,
      currentAddress,
      distance,
      mapUrl
    );

    // Send to each super admin
    const emailPromises = superAdmins.map((admin) =>
      sendEmail({
        to: admin.email,
        subject: `⚠️ Movement Alert: ${employee.name} moved ${distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`} from check-in`,
        html: emailHtml,
      })
    );

    // Fire and forget — don't block the response
    Promise.allSettled(emailPromises).then((results) => {
      const sent = results.filter((r) => r.status === "fulfilled").length;
      console.log(`Movement alert for ${employee.name}: ${sent}/${superAdmins.length} emails sent (${distance}m moved)`);
    });

    // Also create a notification for audit
    await prisma.notification.create({
      data: {
        userId,
        title: "Location Movement Detected",
        message: `You have moved ${distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`} from your check-in location. This has been reported.`,
        link: "/dashboard",
      },
    });

    return apiResponse({ status: "alert_sent", distance });
  } catch (error) {
    console.error("Location ping error:", error);
    return apiError("Internal server error", 500);
  }
}
