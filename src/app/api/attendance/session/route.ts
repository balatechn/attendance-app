import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import { isWithinGeofence, haversineDistance } from "@/lib/geo";
import { reverseGeocode } from "@/lib/geocode";
import { getDayRange, getWorkingMinutes, getOvertimeMinutes, isLateArrival, getShiftLateThreshold } from "@/lib/datetime";
import { sendEmail, movementAlertEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    // Rate limit
    if (!checkRateLimit(`attendance:${session.user.id}`, 10, 60_000)) {
      return apiError("Too many requests", 429);
    }

    const body = await request.json();
    const { type, latitude, longitude, deviceInfo } = body;

    // Validate input
    if (!type || !["CHECK_IN", "CHECK_OUT"].includes(type)) {
      return apiError("Invalid session type");
    }
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return apiError("Invalid location data");
    }

    const userId = session.user.id;
    const { start, end } = getDayRange(new Date());

    // Get today's sessions
    const todaySessions = await prisma.attendanceSession.findMany({
      where: { userId, timestamp: { gte: start, lte: end } },
      orderBy: { timestamp: "asc" },
    });

    // Prevent duplicate: Check if last action matches current action
    if (todaySessions.length > 0) {
      const lastSession = todaySessions[todaySessions.length - 1];
      if (lastSession.type === type) {
        return apiError(
          type === "CHECK_IN"
            ? "Already checked in. Please check out first."
            : "Already checked out. Please check in first."
        );
      }
    } else if (type === "CHECK_OUT") {
      return apiError("Cannot check out without checking in first");
    }

    // Geofence validation (only enforce if GEOFENCE_ENFORCE is true)
    const geofenceConfig = await prisma.appConfig.findUnique({
      where: { key: "GEOFENCE_ENFORCE" },
    });
    const enforceGeofence = geofenceConfig?.value === "true";

    // Check per-user geofence setting
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { geofenceEnabled: true },
    });

    if (enforceGeofence && currentUser?.geofenceEnabled !== false) {
      const geoFences = await prisma.geoFence.findMany({
        where: { isActive: true },
      });

      if (geoFences.length > 0) {
        const { allowed, nearestDistance } = isWithinGeofence(
          latitude,
          longitude,
          geoFences
        );

        if (!allowed) {
          return apiError(
            `You are ${nearestDistance}m away from the nearest allowed location. Please move closer.`,
            403,
            "OUTSIDE_GEOFENCE"
          );
        }
      }
    }

    // Reverse geocode to get address (non-blocking — fallback to coords)
    const address = await reverseGeocode(latitude, longitude);

    // Create session
    const attendanceSession = await prisma.attendanceSession.create({
      data: {
        userId,
        type,
        latitude,
        longitude,
        address,
        deviceInfo: deviceInfo || null,
        timestamp: new Date(),
      },
    });

    // Update daily summary
    const allSessions = [...todaySessions, attendanceSession];
    const { workMins, breakMins } = getWorkingMinutes(
      allSessions.map((s) => ({
        type: s.type,
        timestamp: s.timestamp,
      }))
    );

    const firstCheckIn = allSessions.find((s) => s.type === "CHECK_IN")?.timestamp;
    const checkOuts = allSessions.filter((s) => s.type === "CHECK_OUT");
    const lastCheckOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].timestamp : null;

    // Fetch employee's shift for shift-aware late/overtime detection
    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: { shift: true },
    });
    const shift = employee?.shift;
    const lateThreshold = shift
      ? getShiftLateThreshold(shift.startTime, shift.graceMinutes)
      : "09:10"; // fallback: 09:00 + 10min grace
    const standardWorkMins = shift?.standardWorkMins ?? 480;

    const overtimeMins = getOvertimeMinutes(workMins, standardWorkMins / 60);
    const isLate = firstCheckIn ? isLateArrival(firstCheckIn, lateThreshold) : false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let status = "PRESENT";
    if (isLate) status = "LATE";
    if (workMins > 0 && workMins < 240) status = "HALF_DAY"; // Less than 4 hours

    await prisma.dailySummary.upsert({
      where: {
        userId_date: { userId, date: today },
      },
      create: {
        userId,
        date: today,
        firstCheckIn: firstCheckIn || null,
        lastCheckOut,
        totalWorkMins: workMins,
        totalBreakMins: breakMins,
        overtimeMins,
        sessionCount: allSessions.length,
        status,
      },
      update: {
        firstCheckIn: firstCheckIn || undefined,
        lastCheckOut,
        totalWorkMins: workMins,
        totalBreakMins: breakMins,
        overtimeMins,
        sessionCount: allSessions.length,
        status,
      },
    });

    // Create notification for the user
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
    if (type === "CHECK_IN") {
      const shiftName = shift?.name || "General";
      await prisma.notification.create({
        data: {
          userId,
          title: isLate ? "Late Check-In Recorded" : "Check-In Successful",
          message: isLate
            ? `You checked in late at ${timeStr} (${shiftName} shift starts at ${shift?.startTime || "09:00"}). Please ensure timely attendance.`
            : `You checked in at ${timeStr}. Have a productive day!`,
          link: "/dashboard",
        },
      });
    } else {
      const hours = Math.floor(workMins / 60);
      const mins = workMins % 60;
      await prisma.notification.create({
        data: {
          userId,
          title: "Check-Out Successful",
          message: `You checked out at ${timeStr}. Total work: ${hours}h ${mins}m${overtimeMins > 0 ? ` (${overtimeMins}m overtime)` : ""}.`,
          link: "/dashboard",
        },
      });
    }

    // Check-out movement alert: compare check-out location vs first check-in
    if (type === "CHECK_OUT") {
      const firstCI = allSessions.find((s) => s.type === "CHECK_IN");
      if (firstCI) {
        try {
          const [alertConfig, thresholdConfig] = await Promise.all([
            prisma.appConfig.findUnique({ where: { key: "MOVEMENT_ALERT_ENABLED" } }),
            prisma.appConfig.findUnique({ where: { key: "MOVEMENT_ALERT_DISTANCE" } }),
          ]);
          const alertEnabled = alertConfig?.value !== "false";
          const thresholdM = parseInt(thresholdConfig?.value || "500", 10);

          if (alertEnabled) {
            const movedDistance = Math.round(
              haversineDistance(firstCI.latitude, firstCI.longitude, latitude, longitude)
            );

            if (movedDistance > thresholdM) {
              const [empInfo, superAdmins] = await Promise.all([
                prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
                prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { email: true } }),
              ]);

              if (empInfo && superAdmins.length > 0) {
                const ciAddr = firstCI.address || `${firstCI.latitude.toFixed(6)}, ${firstCI.longitude.toFixed(6)}`;
                const coAddr = address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                const ciTime = firstCI.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
                const mapUrl = `https://www.google.com/maps/dir/${firstCI.latitude},${firstCI.longitude}/${latitude},${longitude}`;
                const distStr = movedDistance >= 1000 ? `${(movedDistance / 1000).toFixed(1)}km` : `${movedDistance}m`;

                const emailHtml = movementAlertEmail(empInfo.name, empInfo.email, ciTime, ciAddr, coAddr, movedDistance, mapUrl);
                Promise.allSettled(
                  superAdmins.map((a) =>
                    sendEmail({ to: a.email, subject: `⚠️ Checkout Movement Alert: ${empInfo.name} moved ${distStr}`, html: emailHtml })
                  )
                ).then((results) => {
                  const sent = results.filter((r) => r.status === "fulfilled").length;
                  console.log(`Checkout movement alert for ${empInfo.name}: ${sent}/${superAdmins.length} emails (${movedDistance}m)`);
                });
              }
            }
          }
        } catch (alertErr) {
          console.error("Checkout movement alert error (non-blocking):", alertErr);
        }
      }
    }

    return apiResponse({
      session: {
        id: attendanceSession.id,
        type: attendanceSession.type,
        timestamp: attendanceSession.timestamp.toISOString(),
      },
      summary: {
        totalWorkMins: workMins,
        totalBreakMins: breakMins,
        overtimeMins,
        status,
      },
    });
  } catch (error) {
    console.error("Attendance session error:", error);
    return apiError("Internal server error", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();

    const { start, end } = getDayRange(date);

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        userId: session.user.id,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: "asc" },
    });

    return apiResponse(
      sessions.map((s) => ({
        id: s.id,
        type: s.type,
        timestamp: s.timestamp.toISOString(),
        latitude: s.latitude,
        longitude: s.longitude,
        address: s.address || null,
      }))
    );
  } catch (error) {
    console.error("Get sessions error:", error);
    return apiError("Internal server error", 500);
  }
}
