import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") || new Date().toISOString();
    const date = new Date(dateParam);
    date.setHours(0, 0, 0, 0);

    const summary = await prisma.dailySummary.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date,
        },
      },
    });

    if (!summary) {
      return apiResponse(null);
    }

    return apiResponse({
      firstCheckIn: summary.firstCheckIn?.toISOString() || null,
      lastCheckOut: summary.lastCheckOut?.toISOString() || null,
      totalWorkMins: summary.totalWorkMins,
      totalBreakMins: summary.totalBreakMins,
      overtimeMins: summary.overtimeMins,
      sessionCount: summary.sessionCount,
      status: summary.status,
    });
  } catch (error) {
    console.error("Summary error:", error);
    return apiError("Internal server error", 500);
  }
}
