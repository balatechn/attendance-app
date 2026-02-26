import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDayRange } from "@/lib/datetime";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const { start, end } = getDayRange(new Date());

  // Fetch today's sessions and summary
  const [sessions, dailySummary] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: "asc" },
    }),
    prisma.dailySummary.findFirst({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
    }),
  ]);

  // Determine if currently checked in (odd number of sessions means checked in)
  const checkedIn = sessions.length > 0 && sessions.length % 2 !== 0;
  const lastSession = sessions[sessions.length - 1];

  return (
    <DashboardClient
      user={{
        name: session.user.name,
        role: session.user.role,
      }}
      sessions={sessions.map((s) => ({
        id: s.id,
        type: s.type,
        timestamp: s.timestamp.toISOString(),
        latitude: s.latitude,
        longitude: s.longitude,
        address: s.address || null,
      }))}
      summary={
        dailySummary
          ? {
              firstCheckIn: dailySummary.firstCheckIn?.toISOString() || null,
              lastCheckOut: dailySummary.lastCheckOut?.toISOString() || null,
              totalWorkMins: dailySummary.totalWorkMins,
              totalBreakMins: dailySummary.totalBreakMins,
              overtimeMins: dailySummary.overtimeMins,
              sessionCount: dailySummary.sessionCount,
              status: dailySummary.status,
            }
          : null
      }
      isCheckedIn={checkedIn}
      lastCheckInTime={
        checkedIn && lastSession ? lastSession.timestamp.toISOString() : null
      }
    />
  );
}
