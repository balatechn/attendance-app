import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";

// Public endpoint: fetch active locations for registration form
export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return apiResponse(locations);
  } catch (error) {
    console.error("Public locations error:", error);
    return apiError("Failed to fetch locations", 500);
  }
}
