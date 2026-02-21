import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError, checkRateLimit } from "@/lib/api-utils";
import { isWithinGeofence } from "@/lib/geo";
import { getDayRange, getWorkingMinutes, getOvertimeMinutes, isLateArrival } from "@/lib/datetime";

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

    // Geofence validation
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

    // Create session
    const attendanceSession = await prisma.attendanceSession.create({
      data: {
        userId,
        type,
        latitude,
        longitude,
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

    const overtimeMins = getOvertimeMinutes(workMins);
    const isLate = firstCheckIn ? isLateArrival(firstCheckIn) : false;
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
      }))
    );
  } catch (error) {
    console.error("Get sessions error:", error);
    return apiError("Internal server error", 500);
  }
}
