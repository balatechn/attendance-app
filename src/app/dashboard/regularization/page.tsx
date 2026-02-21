import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { RegularizationPageClient } from "./regularization-client";

export const dynamic = "force-dynamic";

export default async function RegularizationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const regularizations = await prisma.regularization.findMany({
    where: { employeeId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <RegularizationPageClient
      regularizations={regularizations.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        type: r.type,
        reason: r.reason,
        status: r.status,
        reviewNote: r.reviewNote || undefined,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
