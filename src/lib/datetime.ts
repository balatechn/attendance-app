import { format, differenceInMinutes, startOfDay, endOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

export function formatTime(date: Date | string): string {
  return formatInTimeZone(new Date(date), IST, "hh:mm a");
}

export function formatDate(date: Date | string): string {
  return formatInTimeZone(new Date(date), IST, "MMM dd, yyyy");
}

export function formatDateTime(date: Date | string): string {
  return formatInTimeZone(new Date(date), IST, "MMM dd, yyyy hh:mm a");
}

/** Format with a custom pattern in IST */
export function formatIST(date: Date | string, pattern: string): string {
  return formatInTimeZone(new Date(date), IST, pattern);
}

export function minutesToHoursMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function getWorkingMinutes(
  sessions: { type: "CHECK_IN" | "CHECK_OUT"; timestamp: Date | string }[]
): { workMins: number; breakMins: number } {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let workMins = 0;
  let breakMins = 0;
  let lastCheckIn: Date | null = null;
  let lastCheckOut: Date | null = null;

  for (const session of sorted) {
    const ts = new Date(session.timestamp);
    if (session.type === "CHECK_IN") {
      if (lastCheckOut) {
        breakMins += differenceInMinutes(ts, lastCheckOut);
      }
      lastCheckIn = ts;
      lastCheckOut = null;
    } else {
      if (lastCheckIn) {
        workMins += differenceInMinutes(ts, lastCheckIn);
        lastCheckOut = ts;
        lastCheckIn = null;
      }
    }
  }

  // If still checked in, count until now
  if (lastCheckIn) {
    workMins += differenceInMinutes(new Date(), lastCheckIn);
  }

  return { workMins, breakMins };
}

export function getOvertimeMinutes(
  totalWorkMins: number,
  standardHours = 8
): number {
  const standardMins = standardHours * 60;
  return Math.max(0, totalWorkMins - standardMins);
}

export function getDayRange(date: Date): { start: Date; end: Date } {
  return { start: startOfDay(date), end: endOfDay(date) };
}

export function isLateArrival(
  firstCheckIn: Date | string,
  lateThreshold = "09:30"
): boolean {
  const time = formatInTimeZone(new Date(firstCheckIn), IST, "HH:mm");
  return time > lateThreshold;
}
