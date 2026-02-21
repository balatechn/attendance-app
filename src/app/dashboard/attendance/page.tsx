import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDayRange } from "@/lib/datetime";
import { AttendancePageClient } from "./attendance-client";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const { start, end } = getDayRange(new Date());

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      userId,
      timestamp: { gte: start, lte: end },
    },
    orderBy: { timestamp: "asc" },
  });

  const recentSummaries = await prisma.dailySummary.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 7,
  });

  return (
    <AttendancePageClient
      sessions={sessions.map((s) => ({
        id: s.id,
        type: s.type,
        timestamp: s.timestamp.toISOString(),
        latitude: s.latitude,
        longitude: s.longitude,
      }))}
      recentDays={recentSummaries.map((d) => ({
        date: d.date.toISOString(),
        status: d.status,
        totalWorkMins: d.totalWorkMins,
        firstCheckIn: d.firstCheckIn?.toISOString() || null,
        lastCheckOut: d.lastCheckOut?.toISOString() || null,
      }))}
    />
  );
}
