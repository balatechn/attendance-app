"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge } from "@/components/ui";
import { STATUS_COLORS } from "@/lib/constants";

interface LeaveType {
  id: string;
  name: string;
  code: string;
  isFixed: boolean;
  defaultDays: number;
  accrualPerMonth: number | null;
}

interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  leaveType: string;
  leaveCode: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  approverName: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface LeaveBalance {
  id: string;
  leaveType: string;
  leaveCode: string;
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface Props {
  currentUserId: string;
  canApprove: boolean;
  leaveTypes: LeaveType[];
  requests: LeaveRequest[];
  balances: LeaveBalance[];
}

const BALANCE_COLORS = [
  "from-amber-500 to-yellow-400",
  "from-green-500 to-emerald-400",
  "from-purple-500 to-pink-400",
  "from-orange-500 to-amber-400",
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type ViewTab = "my-leaves" | "team-leaves";

export function LeavesClient({ currentUserId, canApprove, leaveTypes, requests, balances }: Props) {
  const router = useRouter();
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("my-leaves");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    leaveTypeId: leaveTypes[0]?.id || "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const myRequests = requests.filter((r) => r.userId === currentUserId);
  const teamRequests = requests.filter((r) => r.userId !== currentUserId);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to apply");
        return;
      }
      setSuccess("Leave request submitted! Your manager has been notified.");
      setForm({ leaveTypeId: leaveTypes[0]?.id || "", startDate: "", endDate: "", reason: "" });
      setTimeout(() => {
        setShowApplyForm(false);
        setSuccess("");
        router.refresh();
      }, 2000);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (requestId: string, status: "APPROVED" | "REJECTED") => {
    setReviewLoading(requestId);
    try {
      const res = await fetch(`/api/leaves/${requestId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
      } else {
        alert(data.error?.message || "Failed");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setReviewLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Leave Management</h2>
        <Button
          size="sm"
          onClick={() => { setShowApplyForm(!showApplyForm); setError(""); setSuccess(""); }}
        >
          {showApplyForm ? "Cancel" : (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Apply Leave
            </>
          )}
        </Button>
      </div>

      {/* Leave Balances */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {balances.length > 0 ? (
          balances.map((bal, i) => (
            <Card key={bal.id} className="relative overflow-hidden !py-3">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${BALANCE_COLORS[i % BALANCE_COLORS.length]}`} />
              <div className="text-center">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{bal.leaveType}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{bal.available}</p>
                <p className="text-[10px] text-gray-400">of {bal.allocated} available</p>
                <div className="flex justify-center gap-2 mt-1">
                  {bal.used > 0 && <span className="text-[9px] text-red-500">{bal.used} used</span>}
                  {bal.pending > 0 && <span className="text-[9px] text-yellow-500">{bal.pending} pending</span>}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="col-span-full text-center !py-6">
            <p className="text-sm text-gray-400">No leave balances allocated yet for this year.</p>
            <p className="text-xs text-gray-400 mt-1">Apply for a leave to auto-initialize your balances.</p>
          </Card>
        )}
      </div>

      {/* Apply Form */}
      {showApplyForm && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Apply for Leave</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Your reporting manager will be notified via email.
          </p>

          <form onSubmit={handleApply} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type</label>
                <select
                  value={form.leaveTypeId}
                  onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                  required
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.code})
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="From"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
              <Input
                label="To"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={3}
                required
                placeholder="Please provide a reason for your leave request..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm px-3 py-2 rounded-lg">
                {success}
              </div>
            )}

            <Button type="submit" loading={loading} size="sm">
              Submit Leave Request
            </Button>
          </form>
        </Card>
      )}

      {/* Tab Navigation */}
      {canApprove && (
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <button
            onClick={() => setViewTab("my-leaves")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewTab === "my-leaves"
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            My Leaves ({myRequests.length})
          </button>
          <button
            onClick={() => setViewTab("team-leaves")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewTab === "team-leaves"
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            Team Requests ({teamRequests.filter((r) => r.status === "PENDING").length} pending)
          </button>
        </div>
      )}

      {/* Requests List */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {viewTab === "team-leaves" ? "Team Leave Requests" : "My Leave Requests"}
        </h3>

        <div className="space-y-3">
          {(viewTab === "team-leaves" ? teamRequests : myRequests).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No leave requests found</p>
          ) : (
            (viewTab === "team-leaves" ? teamRequests : myRequests).map((req) => (
              <div
                key={req.id}
                className="flex items-start justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex-1 min-w-0">
                  {viewTab === "team-leaves" && (
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{req.userName}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                      {req.leaveType}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(req.startDate)} → {formatDate(req.endDate)}
                    </span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      ({req.days} day{req.days > 1 ? "s" : ""})
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{req.reason}</p>
                  {req.approverName && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Reviewed by: {req.approverName}
                      {req.reviewNote && ` — "${req.reviewNote}"`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <Badge variant={STATUS_COLORS[req.status]}>
                    {req.status}
                  </Badge>

                  {viewTab === "team-leaves" && req.status === "PENDING" && canApprove && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleReview(req.id, "APPROVED")}
                        disabled={reviewLoading === req.id}
                        className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleReview(req.id, "REJECTED")}
                        disabled={reviewLoading === req.id}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
                        title="Reject"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
