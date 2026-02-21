import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { Card } from "@/components/ui";
import type { Role } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!hasPermission(session.user.role as Role, "settings:manage")) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Settings
      </h2>

      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          General Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Standard Work Hours</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Hours expected per day</p>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">8h</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Late Arrival Threshold</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Time after which arrival is late</p>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">09:30</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Auto Checkout</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Auto checkout if forgot</p>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">11:00 PM</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Default Geofence Radius</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">In meters</p>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">200m</span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Email Notifications
        </h3>
        <div className="space-y-3">
          {[
            "Send email on regularization request",
            "Send email on approval/rejection",
            "Daily summary email to managers",
            "Weekly report to HR",
          ].map((label) => (
            <div key={label} className="flex items-center justify-between py-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
              <div className="w-10 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
