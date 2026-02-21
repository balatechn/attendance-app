"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar, BottomNav } from "@/components/layout/navigation";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </SessionProvider>
  );
}
