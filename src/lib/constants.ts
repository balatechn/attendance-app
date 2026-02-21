export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "National Group India AttendEase";
export const APP_SHORT_NAME = "NGI AttendEase";
export const DEFAULT_GEOFENCE_RADIUS = Number(process.env.NEXT_PUBLIC_DEFAULT_GEOFENCE_RADIUS) || 200;
export const STANDARD_WORK_HOURS = 8;
export const LATE_THRESHOLD = "09:30"; // HH:mm 24-hour format
export const AUTO_CHECKOUT_HOUR = 23; // Auto checkout at 11 PM if forgot

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "Home" },
  { label: "Attendance", href: "/dashboard/attendance", icon: "Clock" },
  { label: "Leaves", href: "/dashboard/leaves", icon: "Calendar" },
  { label: "Reports", href: "/dashboard/reports", icon: "BarChart" },
  { label: "Profile", href: "/dashboard/profile", icon: "User" },
] as const;

export const ADMIN_NAV_ITEMS = [
  { label: "Employees", href: "/dashboard/employees", icon: "Users" },
  { label: "Approvals", href: "/dashboard/approvals", icon: "CheckCircle" },
  { label: "Admin Reports", href: "/dashboard/admin-reports", icon: "FileText" },
  { label: "Geofence", href: "/dashboard/geofence", icon: "MapPin" },
  { label: "Settings", href: "/dashboard/settings", icon: "Settings" },
] as const;

export const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  LATE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  HALF_DAY: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ON_LEAVE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};
