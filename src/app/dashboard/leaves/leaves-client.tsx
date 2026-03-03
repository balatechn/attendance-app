"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge } from "@/components/ui";
import { STATUS_COLORS } from "@/lib/constants";

/* ─── Types ─────────────────────────────────────────────── */

interface LeaveType {
  id: string;
  name: string;
  code: string;
  isFixed: boolean;
  defaultDays: number;
  accrualPerMonth: number | null;
  minAdvanceNoticeDays: number | null;
  certRequiredAfterDays: number | null;
  maxExpiryDays: number | null;
  carryForward: boolean;
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

interface EmployeeBalance {
  id: string;
  leaveTypeId: string;
  leaveType: string;
  leaveCode: string;
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  entityName: string;
  departmentName: string;
  balances: EmployeeBalance[];
}

interface Props {
  currentUserId: string;
  canApprove: boolean;
  canManageBalance: boolean;
  leaveTypes: LeaveType[];
  requests: LeaveRequest[];
  balances: LeaveBalance[];
  employees: Employee[];
  year: number;
}

/* ─── Helpers ───────────────────────────────────────────── */

const BALANCE_COLORS = [
  { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", accent: "bg-amber-500" },
  { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300", accent: "bg-green-500" },
  { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", accent: "bg-purple-500" },
  { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", accent: "bg-blue-500" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type ViewTab = "my-leaves" | "team-leaves" | "manage-balance";

/* ─── Component ─────────────────────────────────────────── */

export function LeavesClient({
  currentUserId,
  canApprove,
  canManageBalance,
  leaveTypes,
  requests,
  balances,
  employees,
  year,
}: Props) {
  const router = useRouter();
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("my-leaves");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  // Apply form state
  const [form, setForm] = useState({
    leaveTypeId: leaveTypes[0]?.id || "",
    startDate: "",
    endDate: "",
    reason: "",
    certNote: "",
  });

  // Balance adjustment state
  const [adjSearch, setAdjSearch] = useState("");
  const [adjEmployee, setAdjEmployee] = useState<Employee | null>(null);
  const [adjForm, setAdjForm] = useState({ leaveTypeId: "", adjustment: "", reason: "" });
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjMsg, setAdjMsg] = useState("");

  const selectedLeaveType = leaveTypes.find((lt) => lt.id === form.leaveTypeId);
  const formDays =
    form.startDate && form.endDate
      ? Math.max(1, Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 0;
  const needsCertNote =
    selectedLeaveType?.certRequiredAfterDays != null && formDays > selectedLeaveType.certRequiredAfterDays;

  const myRequests = requests.filter((r) => r.userId === currentUserId);
  const teamRequests = requests.filter((r) => r.userId !== currentUserId);

  // Filter employees for balance management search
  const filteredEmployees = useMemo(() => {
    if (!adjSearch.trim()) return employees;
    const q = adjSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q)
    );
  }, [employees, adjSearch]);

  /* ─── Handlers ─────────── */

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
      setForm({ leaveTypeId: leaveTypes[0]?.id || "", startDate: "", endDate: "", reason: "", certNote: "" });
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

  const handleBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjEmployee) return;
    setAdjLoading(true);
    setAdjMsg("");
    try {
      const res = await fetch("/api/leaves/balance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: adjEmployee.id,
          leaveTypeId: adjForm.leaveTypeId,
          year,
          adjustment: parseFloat(adjForm.adjustment),
          reason: adjForm.reason,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setAdjMsg(`Error: ${data.error?.message || "Failed"}`);
      } else {
        setAdjMsg(
          `Successfully ${parseFloat(adjForm.adjustment) > 0 ? "credited" : "deducted"} ${Math.abs(parseFloat(adjForm.adjustment))} day(s). New available: ${data.data.available}`
        );
        setAdjForm({ leaveTypeId: "", adjustment: "", reason: "" });
        setTimeout(() => router.refresh(), 1500);
      }
    } catch {
      setAdjMsg("Error: Something went wrong");
    } finally {
      setAdjLoading(false);
    }
  };

  /* ─── Balance Cards (Employee View) ─────────── */

  const BalanceCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {balances.length > 0 ? (
        balances.map((bal, i) => {
          const c = BALANCE_COLORS[i % BALANCE_COLORS.length];
          const pct = bal.allocated > 0 ? ((bal.used + bal.pending) / bal.allocated) * 100 : 0;
          return (
            <div
              key={bal.id}
              className={`rounded-xl border ${c.border} ${c.bg} p-4 relative overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>
                  {bal.leaveCode}
                </h4>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{bal.leaveType}</span>
              </div>

              {/* Big available number */}
              <div className="text-center mb-3">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{bal.available}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Available</p>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 mb-3">
                <div
                  className={`h-full rounded-full ${c.accent} transition-all`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-1 text-center">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{bal.allocated}</p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400">Opening</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">{bal.used}</p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400">Used</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{bal.pending}</p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400">Pending</p>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <Card className="col-span-full text-center !py-6">
          <p className="text-sm text-gray-400">No leave balances allocated yet for {year}.</p>
          <p className="text-xs text-gray-400 mt-1">Apply for a leave to auto-initialize your balances, or ask management to credit leaves.</p>
        </Card>
      )}
    </div>
  );

  /* ─── Manage Balance Tab ─────────── */

  const ManageBalanceView = () => (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search employee by name, email, or code..."
          value={adjSearch}
          onChange={(e) => { setAdjSearch(e.target.value); setAdjEmployee(null); setAdjMsg(""); }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Employee List / Selected Employee */}
      {adjEmployee ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">{adjEmployee.name}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {adjEmployee.employeeCode} · {adjEmployee.departmentName} · {adjEmployee.entityName}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setAdjEmployee(null); setAdjMsg(""); setAdjForm({ leaveTypeId: "", adjustment: "", reason: "" }); }}
            >
              ← Back
            </Button>
          </div>

          {/* Current Balances Table */}
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Leave Type</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Allocated</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Used</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Pending</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Available</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((lt) => {
                  const bal = adjEmployee.balances.find((b) => b.leaveTypeId === lt.id);
                  return (
                    <tr key={lt.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-2 text-gray-900 dark:text-white font-medium">
                        {lt.name} <span className="text-xs text-gray-400">({lt.code})</span>
                      </td>
                      <td className="py-2 px-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                        {bal?.allocated ?? 0}
                      </td>
                      <td className="py-2 px-2 text-center text-red-600 dark:text-red-400 font-medium">
                        {bal?.used ?? 0}
                      </td>
                      <td className="py-2 px-2 text-center text-yellow-600 dark:text-yellow-400 font-medium">
                        {bal?.pending ?? 0}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-green-600 dark:text-green-400">
                        {bal?.available ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Adjustment Form */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h5 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
              Adjust Balance
            </h5>
            <form onSubmit={handleBalanceAdjustment} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type</label>
                  <select
                    value={adjForm.leaveTypeId}
                    onChange={(e) => setAdjForm({ ...adjForm, leaveTypeId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                    required
                  >
                    <option value="">Select type</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} ({lt.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Days (+credit / −deduct)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={adjForm.adjustment}
                    onChange={(e) => setAdjForm({ ...adjForm, adjustment: e.target.value })}
                    placeholder="e.g. 2 or -1"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                  <input
                    type="text"
                    value={adjForm.reason}
                    onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                    placeholder="Opening balance / Correction / etc."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" loading={adjLoading}>
                  Apply Adjustment
                </Button>
                {adjMsg && (
                  <p className={`text-xs ${adjMsg.startsWith("Error") ? "text-red-500" : "text-green-500"}`}>
                    {adjMsg}
                  </p>
                )}
              </div>
            </form>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400">Employee</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Dept</th>
                  {leaveTypes.map((lt) => (
                    <th key={lt.id} className="text-center py-2.5 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400" title={lt.name}>
                      {lt.code}
                    </th>
                  ))}
                  <th className="py-2.5 px-3" />
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={3 + leaveTypes.length} className="text-center py-8 text-sm text-gray-400">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                      onClick={() => { setAdjEmployee(emp); setAdjMsg(""); setAdjForm({ leaveTypeId: "", adjustment: "", reason: "" }); }}
                    >
                      <td className="py-2.5 px-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</p>
                        <p className="text-[10px] text-gray-400">{emp.employeeCode}</p>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400">{emp.departmentName}</td>
                      {leaveTypes.map((lt) => {
                        const bal = emp.balances.find((b) => b.leaveTypeId === lt.id);
                        return (
                          <td key={lt.id} className="py-2.5 px-2 text-center">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {bal?.available ?? 0}
                            </span>
                            <span className="text-[9px] text-gray-400">/{bal?.allocated ?? 0}</span>
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );

  /* ─── Main Render ─────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Leave Management</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">FY {year}</p>
        </div>
        {viewTab !== "manage-balance" && (
          <Button
            size="sm"
            onClick={() => {
              setShowApplyForm(!showApplyForm);
              setError("");
              setSuccess("");
            }}
          >
            {showApplyForm ? (
              "Cancel"
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Apply Leave
              </>
            )}
          </Button>
        )}
      </div>

      {/* Balance Summary Cards (always visible for employee) */}
      {viewTab !== "manage-balance" && <BalanceCards />}

      {/* Apply Form */}
      {showApplyForm && viewTab !== "manage-balance" && (
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

            {needsCertNote && (
              <div>
                <label className="block text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                  Medical Certificate Note * (required for {selectedLeaveType?.name} &gt; {selectedLeaveType?.certRequiredAfterDays} days)
                </label>
                <textarea
                  value={form.certNote}
                  onChange={(e) => setForm({ ...form, certNote: e.target.value })}
                  rows={2}
                  required
                  placeholder="Provide medical certificate reference, doctor name, or details..."
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm text-gray-700 dark:text-gray-300 resize-none"
                />
              </div>
            )}

            {selectedLeaveType && (
              <div className="flex flex-wrap gap-2">
                {selectedLeaveType.minAdvanceNoticeDays != null && selectedLeaveType.minAdvanceNoticeDays > 0 && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                    Min {selectedLeaveType.minAdvanceNoticeDays} days advance notice
                  </span>
                )}
                {selectedLeaveType.certRequiredAfterDays != null && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                    Medical cert if &gt; {selectedLeaveType.certRequiredAfterDays} days
                  </span>
                )}
                {selectedLeaveType.maxExpiryDays != null && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                    Must use within {selectedLeaveType.maxExpiryDays} days
                  </span>
                )}
                {!selectedLeaveType.carryForward && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    No carry forward
                  </span>
                )}
              </div>
            )}

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
      {(canApprove || canManageBalance) && (
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
          <button
            onClick={() => setViewTab("my-leaves")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              viewTab === "my-leaves"
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            My Leaves ({myRequests.length})
          </button>
          {canApprove && (
            <button
              onClick={() => setViewTab("team-leaves")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                viewTab === "team-leaves"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Team ({teamRequests.filter((r) => r.status === "PENDING").length} pending)
            </button>
          )}
          {canManageBalance && (
            <button
              onClick={() => setViewTab("manage-balance")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                viewTab === "manage-balance"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Manage Balances
            </button>
          )}
        </div>
      )}

      {/* Content based on tab */}
      {viewTab === "manage-balance" && canManageBalance ? (
        <ManageBalanceView />
      ) : (
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
      )}
    </div>
  );
}
