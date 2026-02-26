import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { sendEmail } from "@/lib/email";
import { getDayRange, formatIST } from "@/lib/datetime";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

/**
 * Cron job to send attendance reminder emails.
 * Called by Vercel Cron at configured intervals.
 *
 * Logic:
 * - Check-in reminder: employees who haven't checked in and it's past their shift start + 15 min
 * - Check-out reminder: employees who are still checked in and it's past their shift end + 15 min
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return apiError("Unauthorized", 401);
    }

    const now = new Date();
    const currentTimeIST = formatInTimeZone(now, IST, "HH:mm");
    const todayStr = formatIST(now, "EEEE, MMMM d, yyyy");
    const { start, end } = getDayRange(now);

    // Get all active employees with their shifts and today's sessions
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        shift: {
          select: {
            name: true,
            startTime: true,
            endTime: true,
          },
        },
        sessions: {
          where: { timestamp: { gte: start, lte: end } },
          orderBy: { timestamp: "asc" },
          select: { type: true, timestamp: true },
        },
      },
    });

    // Default shift times if employee has no shift assigned
    const defaultStart = "09:00";
    const defaultEnd = "17:00";

    let checkInReminders = 0;
    let checkOutReminders = 0;

    for (const emp of employees) {
      const shiftStart = emp.shift?.startTime || defaultStart;
      const shiftEnd = emp.shift?.endTime || defaultEnd;
      const shiftName = emp.shift?.name || "General";

      // Format shift times for display
      const shiftStartDisplay = formatTimeDisplay(shiftStart);
      const shiftEndDisplay = formatTimeDisplay(shiftEnd);

      // Add 15 min buffer to shift start for check-in reminder
      const checkInReminderTime = addMinutes(shiftStart, 15);
      // Add 15 min buffer to shift end for check-out reminder
      const checkOutReminderTime = addMinutes(shiftEnd, 15);

      const hasCheckedIn = emp.sessions.some((s) => s.type === "CHECK_IN");
      const sessionCount = emp.sessions.length;
      const isStillCheckedIn = sessionCount > 0 && sessionCount % 2 !== 0;

      // Check-in reminder: past reminder time and employee hasn't checked in
      if (!hasCheckedIn && currentTimeIST >= checkInReminderTime && currentTimeIST < shiftEnd) {
        // Check if we already sent a reminder today (avoid duplicate emails)
        const alreadySent = await prisma.notification.findFirst({
          where: {
            userId: emp.id,
            title: "Check-In Reminder",
            createdAt: { gte: start, lte: end },
          },
        });

        if (!alreadySent) {
          // Send email
          await sendEmail({
            to: emp.email,
            subject: `⏰ Check-In Reminder - ${shiftName}`,
            html: checkInReminderEmail(emp.name, shiftName, shiftStartDisplay, todayStr),
          });

          // Create in-app notification
          await prisma.notification.create({
            data: {
              userId: emp.id,
              title: "Check-In Reminder",
              message: `You haven't checked in yet. Your ${shiftName} started at ${shiftStartDisplay}. Please check in now.`,
              link: "/dashboard",
            },
          });

          checkInReminders++;
        }
      }

      // Check-out reminder: past reminder time and employee is still checked in
      if (isStillCheckedIn && currentTimeIST >= checkOutReminderTime) {
        const alreadySent = await prisma.notification.findFirst({
          where: {
            userId: emp.id,
            title: "Check-Out Reminder",
            createdAt: { gte: start, lte: end },
          },
        });

        if (!alreadySent) {
          // Calculate hours worked so far
          const firstCheckIn = emp.sessions.find((s) => s.type === "CHECK_IN")?.timestamp;
          const hoursWorked = firstCheckIn
            ? Math.round((now.getTime() - new Date(firstCheckIn).getTime()) / (1000 * 60 * 60) * 10) / 10
            : 0;

          await sendEmail({
            to: emp.email,
            subject: `🔔 Check-Out Reminder - ${shiftName}`,
            html: checkOutReminderEmail(emp.name, shiftName, shiftEndDisplay, todayStr, hoursWorked),
          });

          await prisma.notification.create({
            data: {
              userId: emp.id,
              title: "Check-Out Reminder",
              message: `Your ${shiftName} ended at ${shiftEndDisplay}. You've been working for ${hoursWorked}h. Don't forget to check out.`,
              link: "/dashboard",
            },
          });

          checkOutReminders++;
        }
      }
    }

    return apiResponse({
      processed: employees.length,
      checkInReminders,
      checkOutReminders,
      currentTimeIST,
    });
  } catch (error) {
    console.error("Attendance reminder cron error:", error);
    return apiError("Internal server error", 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMins = h * 60 + m + minutes;
  const hrs = Math.floor(totalMins / 60) % 24;
  const mins = totalMins % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

// ─── Email Templates ──────────────────────────────────────

function checkInReminderEmail(
  name: string,
  shiftName: string,
  shiftStart: string,
  today: string
): string {
  return `
    <h2 style="color:#1e293b;margin:0 0 16px;">⏰ Check-In Reminder</h2>
    <p style="color:#475569;line-height:1.6;">
      Hi <strong>${name}</strong>,
    </p>
    <p style="color:#475569;line-height:1.6;">
      You haven't checked in yet today. Your <strong>${shiftName}</strong> was scheduled to start at
      <strong style="color:#dc2626;">${shiftStart}</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:10px 14px;background:#fef2f2;border-left:4px solid #dc2626;font-weight:600;color:#991b1b;">
          📅 ${today}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 14px;background:#f1f5f9;">
          <strong>Shift:</strong> ${shiftName} &nbsp;|&nbsp;
          <strong>Start Time:</strong> ${shiftStart}
        </td>
      </tr>
    </table>
    <p style="color:#475569;line-height:1.6;">
      Please check in as soon as possible to ensure your attendance is recorded correctly.
      If you're on leave, please ignore this reminder.
    </p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/dashboard"
       style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
      Check In Now
    </a>
  `;
}

function checkOutReminderEmail(
  name: string,
  shiftName: string,
  shiftEnd: string,
  today: string,
  hoursWorked: number
): string {
  return `
    <h2 style="color:#1e293b;margin:0 0 16px;">🔔 Check-Out Reminder</h2>
    <p style="color:#475569;line-height:1.6;">
      Hi <strong>${name}</strong>,
    </p>
    <p style="color:#475569;line-height:1.6;">
      Your <strong>${shiftName}</strong> ended at <strong>${shiftEnd}</strong>,
      but you're still checked in.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:10px 14px;background:#fffbeb;border-left:4px solid #f59e0b;font-weight:600;color:#92400e;">
          📅 ${today}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 14px;background:#f1f5f9;">
          <strong>Shift:</strong> ${shiftName} &nbsp;|&nbsp;
          <strong>End Time:</strong> ${shiftEnd} &nbsp;|&nbsp;
          <strong>Hours Worked:</strong> ~${hoursWorked}h
        </td>
      </tr>
    </table>
    <p style="color:#475569;line-height:1.6;">
      Don't forget to check out so your working hours are recorded accurately.
      If you're working overtime, you can check out when you're done.
    </p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/dashboard"
       style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
      Check Out Now
    </a>
  `;
}
