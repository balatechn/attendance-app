"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Input, Button } from "@/components/ui";
import { AddEmployeeModal } from "./add-employee-modal";
import { EditEmployeeModal } from "./edit-employee-modal";
import type { Role } from "@/generated/prisma/enums";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  role: Role;
  departmentId: string | null;
  entityId: string | null;
  locationId: string | null;
  managerId: string | null;
  shiftId: string | null;
  department: { name: string } | null;
  entity: { name: string } | null;
  location: { name: string } | null;
  shift: { name: string } | null;
  reportingTo: string | null;
  isActive: boolean;
  geofenceEnabled: boolean;
  isWorking: boolean;
  lastCheckIn: string | null;
  todaySessions: number;
  totalWorkMins: number;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
}

interface Props {
  employees: Employee[];
  canManageUsers: boolean;
  departments: { id: string; name: string }[];
  entities: { id: string; name: string }[];
  locations: { id: string; name: string; entityId: string | null }[];
  shifts: { id: string; name: string }[];
  managers: { id: string; name: string }[];
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  MANAGEMENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  HR_ADMIN: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  EMPLOYEE: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const AVATAR_COLORS = [
  "from-amber-500 to-yellow-400",
  "from-purple-500 to-pink-400",
  "from-green-500 to-emerald-400",
  "from-orange-500 to-amber-400",
  "from-red-500 to-rose-400",
  "from-indigo-500 to-violet-400",
  "from-teal-500 to-green-400",
  "from-yellow-500 to-orange-400",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function LiveTimer({ checkInTime }: { checkInTime: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(checkInTime).getTime();
    const update = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [checkInTime]);

  return (
    <span className="font-mono text-lg font-bold text-green-600 dark:text-green-400">
      {elapsed}
    </span>
  );
}

export function EmployeesClient({ employees, canManageUsers, departments, entities, locations, shifts, managers }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "working" | "not-working">("all");

  // Filter locations by selected entity
  const filteredLocations = entityFilter
    ? locations.filter((l) => l.entityId === entityFilter)
    : locations;
  const [showAddModal, setShowAddModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [resetEmployee, setResetEmployee] = useState<Employee | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ tempPassword: string; name: string } | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const handleResetPassword = async (emp: Employee) => {
    setResetLoading(true);
    try {
      const res = await fetch(`/api/employees/${emp.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setResetResult({ tempPassword: data.data.tempPassword, name: emp.name });
        setResetEmployee(null);
      } else {
        alert(data.error?.message || "Failed to reset password");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDeleteEmployee(null);
        router.refresh();
      } else {
        alert(data.error?.message || "Failed to delete employee");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  };

  const deptNames = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => e.department?.name && set.add(e.department.name));
    return Array.from(set).sort();
  }, [employees]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.role));
    return Array.from(set);
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = !roleFilter || e.role === roleFilter;
      const matchDept = !deptFilter || e.department?.name === deptFilter;
      const matchEntity = !entityFilter || e.entityId === entityFilter;
      const matchLocation = !locationFilter || e.locationId === locationFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "working" && e.isWorking) ||
        (statusFilter === "not-working" && !e.isWorking);
      return matchSearch && matchRole && matchDept && matchEntity && matchLocation && matchStatus;
    });
  }, [employees, search, roleFilter, deptFilter, entityFilter, locationFilter, statusFilter]);

  const workingCount = employees.filter((e) => e.isWorking).length;
  const totalActive = employees.filter((e) => e.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Employees
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalActive} active employees &middot;{" "}
            <span className="text-green-600 dark:text-green-400 font-medium">{workingCount} working now</span>
          </p>
        </div>
        {canManageUsers && (
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Employee
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center !py-3">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalActive}</p>
          <p className="text-[11px] text-gray-500 font-medium">Total Active</p>
        </Card>
        <Card className="text-center !py-3">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{workingCount}</p>
          <p className="text-[11px] text-gray-500 font-medium">Working Now</p>
        </Card>
        <Card className="text-center !py-3">
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{totalActive - workingCount}</p>
          <p className="text-[11px] text-gray-500 font-medium">Not Checked In</p>
        </Card>
        <Card className="text-center !py-3">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{employees.filter((e) => !e.isActive).length}</p>
          <p className="text-[11px] text-gray-500 font-medium">Inactive</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
          >
            <option value="">All Departments</option>
            {deptNames.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
            ))}
          </select>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(["all", "working", "not-working"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {s === "all" ? "All" : s === "working" ? "🟢 Working" : "⚪ Off"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setLocationFilter("");
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
          >
            <option value="">All Entities</option>
            {entities.map((en) => (
              <option key={en.id} value={en.id}>{en.name}</option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
          >
            <option value="">All Locations</option>
            {filteredLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((emp) => (
          <Card
            key={emp.id}
            className={`relative overflow-hidden transition-all hover:shadow-lg ${
              !emp.isActive ? "opacity-50" : ""
            }`}
          >
            {/* Working indicator strip */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${
                emp.isWorking
                  ? "bg-gradient-to-r from-green-400 to-emerald-500"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            />

            <div className="pt-2">
              {/* Top row: avatar + info + status */}
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`relative flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(emp.name)} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                  {emp.name.charAt(0).toUpperCase()}
                  {/* Online dot */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                      emp.isWorking ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                </div>

                {/* Name & email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {emp.name}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {emp.email}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${ROLE_COLORS[emp.role] || ROLE_COLORS.EMPLOYEE}`}>
                      {emp.role.replace(/_/g, " ")}
                    </span>
                    {emp.department && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {emp.department.name}
                      </span>
                    )}
                    {emp.entity && (
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 flex items-center gap-0.5">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                        </svg>
                        {emp.entity.name}
                      </span>
                    )}
                    {emp.location && (
                      <span className="text-[10px] text-blue-400 dark:text-blue-500 flex items-center gap-0.5">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {emp.location.name}
                      </span>
                    )}
                    {!emp.geofenceEnabled && (
                      <span className="text-[10px] text-orange-500 dark:text-orange-400 flex items-center gap-0.5" title="Geofence disabled">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                        </svg>
                        No Geofence
                      </span>
                    )}
                  </div>
                  {emp.reportingTo && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Reports to: <span className="font-medium text-gray-500 dark:text-gray-400">{emp.reportingTo}</span>
                    </p>
                  )}
                </div>

                {/* Action menu + Live timer */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {canManageUsers && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuId(actionMenuId === emp.id ? null : emp.id);
                        }}
                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {actionMenuId === emp.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                          <div className="absolute right-0 top-8 z-20 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 overflow-hidden">
                            <button
                              onClick={() => {
                                setEditEmployee(emp);
                                setActionMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Employee
                            </button>
                            <button
                              onClick={() => {
                                setResetEmployee(emp);
                                setActionMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                              Reset Password
                            </button>
                            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                            <button
                              onClick={() => {
                                setDeleteEmployee(emp);
                                setActionMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete Employee
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {emp.isWorking && emp.lastCheckIn ? (
                    <div>
                      <LiveTimer checkInTime={emp.lastCheckIn} />
                      <p className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center justify-end gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Working
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                        {emp.totalWorkMins > 0 ? formatDuration(emp.totalWorkMins) : "--:--"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {emp.lastCheckOut ? "Left" : emp.firstCheckIn ? "Break" : "Not checked in"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom stats */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">In</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {formatTime(emp.firstCheckIn)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Out</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {formatTime(emp.lastCheckOut)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sessions</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {emp.todaySessions > 0 ? Math.ceil(emp.todaySessions / 2) : 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm font-medium">No employees found</p>
          <p className="text-xs mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <AddEmployeeModal
          departments={departments}
          entities={entities}
          locations={locations}
          shifts={shifts}
          managers={managers}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Edit Employee Modal */}
      {editEmployee && (
        <EditEmployeeModal
          employee={{
            id: editEmployee.id,
            name: editEmployee.name,
            email: editEmployee.email,
            phone: editEmployee.phone,
            employeeCode: editEmployee.employeeCode,
            role: editEmployee.role,
            departmentId: editEmployee.departmentId,
            entityId: editEmployee.entityId,
            locationId: editEmployee.locationId,
            managerId: editEmployee.managerId,
            shiftId: editEmployee.shiftId,
            isActive: editEmployee.isActive,
            geofenceEnabled: editEmployee.geofenceEnabled,
          }}
          departments={departments}
          entities={entities}
          locations={locations}
          shifts={shifts}
          managers={managers}
          onClose={() => setEditEmployee(null)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Reset Password Confirmation Modal */}
      {resetEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResetEmployee(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <Card>
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <svg className="w-7 h-7 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Reset Password?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  This will generate a new temporary password for <strong>{resetEmployee.name}</strong> and send it via email. They will need to change it on next login.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setResetEmployee(null)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleResetPassword(resetEmployee)}
                    loading={resetLoading}
                    className="flex-1 !bg-orange-600 hover:!bg-orange-700"
                  >
                    Reset Password
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Reset Password Result Modal */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResetResult(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <Card>
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Password Reset!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  A new password has been sent to <strong>{resetResult.name}</strong>&apos;s email.
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">New Temporary Password (backup)</p>
                  <p className="text-lg font-mono font-bold text-amber-900 dark:text-amber-200 tracking-wider">
                    {resetResult.tempPassword}
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">
                    Save this in case the email didn&apos;t reach the employee
                  </p>
                </div>
                <Button onClick={() => setResetResult(null)} className="w-full">
                  Done
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {deleteEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteEmployee(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <Card>
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Delete Employee?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  This will permanently delete <strong>{deleteEmployee.name}</strong> and all their attendance records, leave requests, and regularizations.
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 font-medium mb-4">
                  This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setDeleteEmployee(null)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDeleteEmployee(deleteEmployee)}
                    loading={deleteLoading}
                    className="flex-1 !bg-red-600 hover:!bg-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

