import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/api-utils";
import { startOfMonth, endOfMonth } from "date-fns";
import { formatIST } from "@/lib/datetime";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month") || new Date().toISOString();
    const exportType = searchParams.get("type") || "pdf";

    const monthDate = new Date(monthParam);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);

    const summaries = await prisma.dailySummary.findMany({
      where: {
        userId: session.user.id,
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    if (exportType === "excel") {
      // Dynamic import for xlsx to reduce bundle size
      const XLSX = await import("xlsx");
      const data = summaries.map((s) => ({
        Date: formatIST(s.date, "yyyy-MM-dd"),
        Status: s.status,
        "First Check-in": s.firstCheckIn ? formatIST(s.firstCheckIn, "HH:mm") : "-",
        "Last Check-out": s.lastCheckOut ? formatIST(s.lastCheckOut, "HH:mm") : "-",
        "Work Hours": (s.totalWorkMins / 60).toFixed(1),
        "Break Hours": (s.totalBreakMins / 60).toFixed(1),
        "Overtime Hours": (s.overtimeMins / 60).toFixed(1),
        Sessions: s.sessionCount,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="attendance-${formatIST(monthDate, "yyyy-MM")}.xlsx"`,
        },
      });
    }

    // PDF export
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Attendance Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`${user?.name || ""} - ${formatIST(monthDate, "MMMM yyyy")}`, 14, 32);

    autoTable(doc, {
      startY: 40,
      head: [["Date", "Status", "In", "Out", "Work (h)", "Break (h)", "OT (h)"]],
      body: summaries.map((s) => [
        formatIST(s.date, "dd MMM"),
        s.status,
        s.firstCheckIn ? formatIST(s.firstCheckIn, "HH:mm") : "-",
        s.lastCheckOut ? formatIST(s.lastCheckOut, "HH:mm") : "-",
        (s.totalWorkMins / 60).toFixed(1),
        (s.totalBreakMins / 60).toFixed(1),
        (s.overtimeMins / 60).toFixed(1),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const pdfBuffer = doc.output("arraybuffer");
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="attendance-${formatIST(monthDate, "yyyy-MM")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return apiError("Export failed", 500);
  }
}
