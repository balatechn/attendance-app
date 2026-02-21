import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { getDayRange, getWorkingMinutes, getOvertimeMinutes, isLateArrival } from "@/lib/datetime";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { entries } = await request.json();

    if (!Array.isArray(entries) || entries.length === 0) {
      return apiError("No entries to sync");
    }

    const results = [];

    for (const entry of entries) {
      try {
        const { type, timestamp, latitude, longitude, deviceInfo } = entry;

        const created = await prisma.attendanceSession.create({
          data: {
            userId: session.user.id,
            type,
            timestamp: new Date(timestamp),
            latitude,
            longitude,
            deviceInfo: deviceInfo || null,
          },
        });

        results.push({ id: created.id, success: true });

        // Update daily summary for each synced entry
        const entryDate = new Date(timestamp);
        entryDate.setHours(0, 0, 0, 0);
        const { start, end } = getDayRange(new Date(timestamp));

        const daySessions = await prisma.attendanceSession.findMany({
          where: {
            userId: session.user.id,
            timestamp: { gte: start, lte: end },
          },
          orderBy: { timestamp: "asc" },
        });

        const { workMins, breakMins } = getWorkingMinutes(
          daySessions.map((s) => ({ type: s.type, timestamp: s.timestamp }))
        );

        const firstCheckIn = daySessions.find((s) => s.type === "CHECK_IN")?.timestamp;
        const checkOuts = daySessions.filter((s) => s.type === "CHECK_OUT");
        const lastCheckOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].timestamp : null;

        let status = "PRESENT";
        if (firstCheckIn && isLateArrival(firstCheckIn)) status = "LATE";
        if (workMins > 0 && workMins < 240) status = "HALF_DAY";

        await prisma.dailySummary.upsert({
          where: { userId_date: { userId: session.user.id, date: entryDate } },
          create: {
            userId: session.user.id,
            date: entryDate,
            firstCheckIn: firstCheckIn || null,
            lastCheckOut,
            totalWorkMins: workMins,
            totalBreakMins: breakMins,
            overtimeMins: getOvertimeMinutes(workMins),
            sessionCount: daySessions.length,
            status,
          },
          update: {
            firstCheckIn: firstCheckIn || undefined,
            lastCheckOut,
            totalWorkMins: workMins,
            totalBreakMins: breakMins,
            overtimeMins: getOvertimeMinutes(workMins),
            sessionCount: daySessions.length,
            status,
          },
        });
      } catch (err) {
        results.push({ success: false, error: String(err) });
      }
    }

    return apiResponse({ synced: results.filter((r) => r.success).length, results });
  } catch (error) {
    console.error("Sync error:", error);
    return apiError("Internal server error", 500);
  }
}
