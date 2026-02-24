import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { formatIST } from "@/lib/datetime";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const summaries = await prisma.dailySummary.findMany({
    where: {
      userId,
      date: { gte: monthStart, lte: monthEnd },
    },
    orderBy: { date: "asc" },
  });

  const calendarData = summaries.map((s) => ({
    date: formatIST(s.date, "yyyy-MM-dd"),
    status: s.status,
    totalWorkMins: s.totalWorkMins,
  }));

  const stats = {
    presentDays: summaries.filter((s) => s.status === "PRESENT" || s.status === "LATE").length,
    absentDays: summaries.filter((s) => s.status === "ABSENT").length,
    lateDays: summaries.filter((s) => s.status === "LATE").length,
    totalWorkHours: summaries.reduce((acc, s) => acc + s.totalWorkMins, 0) / 60,
    totalOvertimeHours: summaries.reduce((acc, s) => acc + s.overtimeMins, 0) / 60,
    totalBreakHours: summaries.reduce((acc, s) => acc + s.totalBreakMins, 0) / 60,
    workingDays: summaries.length,
  };

  return (
    <ReportsClient
      calendarData={calendarData}
      stats={stats}
      initialMonth={now.toISOString()}
    />
  );
}
