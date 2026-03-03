import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/datetime";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [user, locations] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { department: true, location: true },
    }),
    prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Profile
      </h2>

      <ProfileClient
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          designation: user.designation,
          departmentName: user.department?.name || null,
          locationId: user.locationId,
          locationName: user.location?.name || null,
          isActive: user.isActive,
          memberSince: formatDate(user.createdAt),
        }}
        locations={locations}
      />

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
