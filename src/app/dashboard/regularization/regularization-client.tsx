"use client";

import { useRouter } from "next/navigation";
import {
  RegularizationList,
  RegularizationForm,
} from "@/components/attendance/regularization";

interface Props {
  regularizations: Array<{
    id: string;
    date: string;
    type: string;
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    reviewNote?: string;
    createdAt: string;
  }>;
}

export function RegularizationPageClient({ regularizations }: Props) {
  const router = useRouter();

  const handleSubmit = async (data: {
    date: string;
    type: string;
    reason: string;
  }) => {
    const res = await fetch("/api/regularization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Failed to submit");
    }

    router.refresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Attendance Regularization
      </h2>

      <RegularizationForm onSubmit={handleSubmit} />

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Your Requests
        </h3>
        <RegularizationList regularizations={regularizations} />
      </div>
    </div>
  );
}
