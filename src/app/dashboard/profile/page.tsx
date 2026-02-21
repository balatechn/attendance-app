import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, Button, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { department: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Profile
      </h2>

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-2xl">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {user.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <Badge className="mt-1">{user.role.replace("_", " ")}</Badge>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500 dark:text-gray-400">Department</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {user.department?.name || "—"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {user.phone || "—"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
            <Badge variant={user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Member since</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {user.createdAt.toLocaleDateString()}
            </span>
          </div>
        </div>
      </Card>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="danger" className="w-full">
          Sign Out
        </Button>
      </form>
    </div>
  );
}
