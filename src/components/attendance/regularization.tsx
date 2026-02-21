"use client";

import { useState } from "react";
import { Card, Badge, Button, Modal, Textarea, Select } from "@/components/ui";
import { formatDate } from "@/lib/datetime";
import { STATUS_COLORS } from "@/lib/constants";

interface Regularization {
  id: string;
  date: string;
  type: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string;
  employee?: { name: string; email: string };
  createdAt: string;
}

interface Props {
  regularizations: Regularization[];
  isApprover?: boolean;
  onApprove?: (id: string, note: string) => Promise<void>;
  onReject?: (id: string, note: string) => Promise<void>;
}

export function RegularizationList({
  regularizations,
  isApprover = false,
  onApprove,
  onReject,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const selected = regularizations.find((r) => r.id === selectedId);

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedId) return;
    setProcessing(true);
    try {
      if (action === "approve" && onApprove) {
        await onApprove(selectedId, reviewNote);
      } else if (action === "reject" && onReject) {
        await onReject(selectedId, reviewNote);
      }
      setSelectedId(null);
      setReviewNote("");
    } finally {
      setProcessing(false);
    }
  };

  const typeLabels: Record<string, string> = {
    MISSED_CHECK_IN: "Missed Check-in",
    MISSED_CHECK_OUT: "Missed Check-out",
    WRONG_TIME: "Wrong Time",
  };

  return (
    <>
      <div className="space-y-3">
        {regularizations.map((reg) => (
          <Card key={reg.id} className="cursor-pointer hover:shadow-md transition-shadow" padding>
            <div
              onClick={() => isApprover && reg.status === "PENDING" && setSelectedId(reg.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  {isApprover && reg.employee && (
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {reg.employee.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(reg.date)} · {typeLabels[reg.type] || reg.type}
                  </p>
                </div>
                <Badge variant={STATUS_COLORS[reg.status]}>
                  {reg.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                {reg.reason}
              </p>
              {reg.reviewNote && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                  Review: {reg.reviewNote}
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Approve/Reject Modal */}
      <Modal
        open={!!selectedId && isApprover}
        onClose={() => { setSelectedId(null); setReviewNote(""); }}
        title="Review Request"
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {selected.employee?.name}
              </p>
              <p className="text-xs text-gray-500">{formatDate(selected.date)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">{selected.reason}</p>
            </div>
            <Textarea
              label="Review Note (optional)"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add a note..."
            />
            <div className="flex gap-3">
              <Button
                variant="primary"
                className="flex-1"
                loading={processing}
                onClick={() => handleAction("approve")}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={processing}
                onClick={() => handleAction("reject")}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── Regularization Request Form ──────────────────────────

interface RequestFormProps {
  onSubmit: (data: {
    date: string;
    type: string;
    reason: string;
  }) => Promise<void>;
}

export function RegularizationForm({ onSubmit }: RequestFormProps) {
  const [date, setDate] = useState("");
  const [type, setType] = useState("MISSED_CHECK_IN");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason) return;
    setLoading(true);
    try {
      await onSubmit({ date, type, reason });
      setSuccess(true);
      setDate("");
      setType("MISSED_CHECK_IN");
      setReason("");
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Request Regularization
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[
            { value: "MISSED_CHECK_IN", label: "Missed Check-in" },
            { value: "MISSED_CHECK_OUT", label: "Missed Check-out" },
            { value: "WRONG_TIME", label: "Wrong Time" },
          ]}
        />
        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain the reason for regularization..."
          required
        />
        <Button type="submit" loading={loading} className="w-full">
          Submit Request
        </Button>
        {success && (
          <p className="text-sm text-green-600 dark:text-green-400 text-center">
            ✓ Request submitted successfully
          </p>
        )}
      </form>
    </Card>
  );
}
