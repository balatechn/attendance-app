"use client";

import { useRouter } from "next/navigation";
import { RegularizationList } from "@/components/attendance/regularization";
import { EmptyState } from "@/components/ui";

interface Props {
  regularizations: Array<{
    id: string;
    date: string;
    type: string;
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    reviewNote?: string;
    employee: { name: string; email: string };
    createdAt: string;
  }>;
}

export function ApprovalsClient({ regularizations }: Props) {
  const router = useRouter();

  const handleApprove = async (id: string, note: string) => {
    await fetch(`/api/regularization/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVED", reviewNote: note }),
    });
    router.refresh();
  };

  const handleReject = async (id: string, note: string) => {
    await fetch(`/api/regularization/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECTED", reviewNote: note }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Pending Approvals
      </h2>

      {regularizations.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="All regularization requests have been reviewed."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      ) : (
        <RegularizationList
          regularizations={regularizations}
          isApprover
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
