"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/components/ui";

// ─── Types ────────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

interface Entity {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
  code: string;
  address: string | null;
  entityId: string | null;
  entityName: string | null;
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

interface EmailConfigData {
  id: string;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
}

interface ShiftData {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  standardWorkMins: number;
  isDefault: boolean;
  isActive: boolean;
  userCount: number;
}

interface LeaveTypeData {
  id: string;
  name: string;
  code: string;
  isFixed: boolean;
  defaultDays: number;
  accrualPerMonth: number | null;
  isActive: boolean;
}

interface Props {
  departments: Department[];
  entities: Entity[];
  locations: Location[];
  shifts: ShiftData[];
  leaveTypes: LeaveTypeData[];
  emailConfig: EmailConfigData | null;
}

type Tab = "departments" | "entities" | "locations" | "shifts" | "leave-types" | "email" | "general";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "departments",
    label: "Departments",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    key: "entities",
    label: "Entities",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: "locations",
    label: "Locations",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "shifts",
    label: "Shifts",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: "leave-types",
    label: "Leave Types",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "email",
    label: "Email Config",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "general",
    label: "General",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// ─── Main Component ───────────────────────────────────────

export function SettingsClient({ departments, entities, locations, shifts, leaveTypes, emailConfig }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("departments");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "departments" && <DepartmentsTab departments={departments} />}
      {activeTab === "entities" && <EntitiesTab entities={entities} />}
      {activeTab === "locations" && <LocationsTab locations={locations} entities={entities} />}
      {activeTab === "shifts" && <ShiftsTab shifts={shifts} />}
      {activeTab === "leave-types" && <LeaveTypesTab leaveTypes={leaveTypes} />}
      {activeTab === "email" && <EmailConfigTab config={emailConfig} />}
      {activeTab === "general" && <GeneralTab />}
    </div>
  );
}

// ─── Departments Tab ──────────────────────────────────────

function DepartmentsTab({ departments: initialDepts }: { departments: Department[] }) {
  const router = useRouter();
  const [departments, setDepartments] = useState(initialDepts);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch("/api/departments", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed");
        return;
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", code: "" });
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (dept: Department) => {
    const res = await fetch("/api/departments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dept.id, isActive: !dept.isActive }),
    });
    const data = await res.json();
    if (data.success) {
      setDepartments((prev) =>
        prev.map((d) => (d.id === dept.id ? { ...d, isActive: !d.isActive } : d))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    const res = await fetch("/api/departments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      setDepartments((prev) => prev.filter((d) => d.id !== id));
    } else {
      alert(data.error?.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Departments</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{departments.length} departments</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ name: "", code: "" });
          }}
        >
          {showForm ? "Cancel" : "+ Add Department"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Department Name"
              placeholder="e.g., Engineering"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              placeholder="e.g., ENG"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}
          <Button type="submit" loading={loading} size="sm">
            {editingId ? "Update" : "Create"} Department
          </Button>
        </form>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Employees</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{dept.name}</td>
                <td className="py-3 px-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{dept.code}</td>
                <td className="py-3 px-3 text-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    {dept.userCount}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => handleToggleActive(dept)}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                      dept.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {dept.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingId(dept.id);
                        setForm({ name: dept.name, code: dept.code });
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(dept.id)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {departments.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">No departments yet. Click &quot;Add Department&quot; to create one.</p>
        )}
      </div>
    </Card>
  );
}

// ─── Entities Tab ─────────────────────────────────────────

function EntitiesTab({ entities: initialEntities }: { entities: Entity[] }) {
  const router = useRouter();
  const [entities, setEntities] = useState(initialEntities);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch("/api/entities", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed");
        return;
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", code: "", address: "" });
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (entity: Entity) => {
    const res = await fetch("/api/entities", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entity.id, isActive: !entity.isActive }),
    });
    const data = await res.json();
    if (data.success) {
      setEntities((prev) =>
        prev.map((e) => (e.id === entity.id ? { ...e, isActive: !e.isActive } : e))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entity?")) return;
    const res = await fetch("/api/entities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      setEntities((prev) => prev.filter((e) => e.id !== id));
    } else {
      alert(data.error?.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Entities / Companies</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{entities.length} entities</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ name: "", code: "", address: "" });
          }}
        >
          {showForm ? "Cancel" : "+ Add Entity"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Entity Name"
              placeholder="e.g., National Group India"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              placeholder="e.g., NGI"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <Input
            label="Address"
            placeholder="Enter office address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <Button type="submit" loading={loading} size="sm">
            {editingId ? "Update" : "Create"} Entity
          </Button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Address</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Employees</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr key={entity.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{entity.name}</td>
                <td className="py-3 px-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{entity.code}</td>
                <td className="py-3 px-3 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">{entity.address || "—"}</td>
                <td className="py-3 px-3 text-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    {entity.userCount}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => handleToggleActive(entity)}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                      entity.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {entity.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingId(entity.id);
                        setForm({ name: entity.name, code: entity.code, address: entity.address || "" });
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(entity.id)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entities.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">No entities yet. Click &quot;Add Entity&quot; to create one.</p>
        )}
      </div>
    </Card>
  );
}

// ─── Locations Tab ────────────────────────────────────────

function LocationsTab({ locations: initialLocations, entities }: { locations: Location[]; entities: Entity[] }) {
  const router = useRouter();
  const [locations, setLocations] = useState(initialLocations);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", entityId: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch("/api/locations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed");
        return;
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", code: "", address: "", entityId: "" });
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (location: Location) => {
    const res = await fetch("/api/locations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: location.id, isActive: !location.isActive }),
    });
    const data = await res.json();
    if (data.success) {
      setLocations((prev) =>
        prev.map((l) => (l.id === location.id ? { ...l, isActive: !l.isActive } : l))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this location?")) return;
    const res = await fetch("/api/locations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } else {
      alert(data.error?.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Locations</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{locations.length} locations</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ name: "", code: "", address: "", entityId: "" });
          }}
        >
          {showForm ? "Cancel" : "+ Add Location"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Location Name"
              placeholder="e.g., Mumbai Head Office"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              placeholder="e.g., MUM-HO"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <Input
            label="Address"
            placeholder="Enter location address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entity</label>
            <select
              value={form.entityId}
              onChange={(e) => setForm({ ...form, entityId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300"
            >
              <option value="">— No Entity —</option>
              {entities.filter((en) => en.isActive).map((en) => (
                <option key={en.id} value={en.id}>{en.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <Button type="submit" loading={loading} size="sm">
            {editingId ? "Update" : "Create"} Location
          </Button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Address</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Employees</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{location.name}</td>
                <td className="py-3 px-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{location.code}</td>
                <td className="py-3 px-3 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">{location.entityName || "—"}</td>
                <td className="py-3 px-3 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">{location.address || "—"}</td>
                <td className="py-3 px-3 text-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    {location.userCount}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => handleToggleActive(location)}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                      location.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {location.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingId(location.id);
                        setForm({ name: location.name, code: location.code, address: location.address || "", entityId: location.entityId || "" });
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(location.id)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {locations.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">No locations yet. Click &quot;Add Location&quot; to create one.</p>
        )}
      </div>
    </Card>
  );
}

// ─── Shifts Tab ───────────────────────────────────────────

function formatTimeDisplay(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function ShiftsTab({ shifts: initialShifts }: { shifts: ShiftData[] }) {
  const router = useRouter();
  const [shifts, setShifts] = useState(initialShifts);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    startTime: "09:00",
    endTime: "17:00",
    graceMinutes: 10,
    standardWorkMins: 480,
    isDefault: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch("/api/shifts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed");
        return;
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", code: "", startTime: "09:00", endTime: "17:00", graceMinutes: 10, standardWorkMins: 480, isDefault: false });
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (shift: ShiftData) => {
    const res = await fetch("/api/shifts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shift.id, isActive: !shift.isActive }),
    });
    const data = await res.json();
    if (data.success) {
      setShifts((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, isActive: !s.isActive } : s))
      );
    }
  };

  const handleSetDefault = async (shift: ShiftData) => {
    const res = await fetch("/api/shifts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shift.id, isDefault: true }),
    });
    const data = await res.json();
    if (data.success) {
      setShifts((prev) =>
        prev.map((s) => ({ ...s, isDefault: s.id === shift.id }))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift?")) return;
    const res = await fetch("/api/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      setShifts((prev) => prev.filter((s) => s.id !== id));
    } else {
      alert(data.error?.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Shifts</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{shifts.length} shifts configured</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ name: "", code: "", startTime: "09:00", endTime: "17:00", graceMinutes: 10, standardWorkMins: 480, isDefault: false });
          }}
        >
          {showForm ? "Cancel" : "+ Add Shift"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Shift Name"
              placeholder="e.g., General Shift"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              placeholder="e.g., GENERAL"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Grace (min)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={form.graceMinutes}
                onChange={(e) => setForm({ ...form, graceMinutes: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Std Hours</label>
              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={form.standardWorkMins / 60}
                onChange={(e) => setForm({ ...form, standardWorkMins: Math.round(parseFloat(e.target.value) * 60) || 480 })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded"
            />
            Set as default shift for new employees
          </label>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <Button type="submit" loading={loading} size="sm">
            {editingId ? "Update" : "Create"} Shift
          </Button>
        </form>
      )}

      {/* Shift Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className={`relative p-4 rounded-xl border-2 transition-colors ${
              shift.isDefault
                ? "border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50"
            }`}
          >
            {shift.isDefault && (
              <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                Default
              </span>
            )}
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">{shift.name}</h4>
              <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {shift.code}
              </span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {formatTimeDisplay(shift.startTime)} – {formatTimeDisplay(shift.endTime)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              <span>Grace: {shift.graceMinutes}min</span>
              <span>•</span>
              <span>Std: {shift.standardWorkMins / 60}h</span>
              <span>•</span>
              <span>{shift.userCount} employee{shift.userCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(shift)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                  shift.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {shift.isActive ? "Active" : "Inactive"}
              </button>
              {!shift.isDefault && (
                <button
                  onClick={() => handleSetDefault(shift)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Set Default
                </button>
              )}
              <button
                onClick={() => {
                  setEditingId(shift.id);
                  setForm({
                    name: shift.name,
                    code: shift.code,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    graceMinutes: shift.graceMinutes,
                    standardWorkMins: shift.standardWorkMins,
                    isDefault: shift.isDefault,
                  });
                  setShowForm(true);
                }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(shift.id)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      {shifts.length === 0 && (
        <p className="text-center py-8 text-gray-400 text-sm">No shifts configured yet. Click &quot;+ Add Shift&quot; to create one.</p>
      )}
    </Card>
  );
}

// ─── Leave Types Tab ──────────────────────────────────────

function LeaveTypesTab({ leaveTypes: initialTypes }: { leaveTypes: LeaveTypeData[] }) {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState(initialTypes);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    isFixed: true,
    defaultDays: 12,
    accrualPerMonth: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId
        ? { id: editingId, ...form, accrualPerMonth: form.isFixed ? null : form.accrualPerMonth }
        : { ...form, accrualPerMonth: form.isFixed ? null : form.accrualPerMonth };

      const res = await fetch("/api/leaves/types", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed");
        return;
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", code: "", isFixed: true, defaultDays: 12, accrualPerMonth: 0 });
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (lt: LeaveTypeData) => {
    const res = await fetch("/api/leaves/types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lt.id, isActive: !lt.isActive }),
    });
    const data = await res.json();
    if (data.success) {
      setLeaveTypes((prev) =>
        prev.map((t) => (t.id === lt.id ? { ...t, isActive: !t.isActive } : t))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave type?")) return;
    const res = await fetch("/api/leaves/types", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      setLeaveTypes((prev) => prev.filter((t) => t.id !== id));
    } else {
      alert(data.error?.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Leave Types</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{leaveTypes.length} leave types</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ name: "", code: "", isFixed: true, defaultDays: 12, accrualPerMonth: 0 });
          }}
        >
          {showForm ? "Cancel" : "+ Add Leave Type"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Leave Type Name"
              placeholder="e.g., Sick Leave"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              placeholder="e.g., SL"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Allocation Type</label>
              <select
                value={form.isFixed ? "fixed" : "accrual"}
                onChange={(e) => setForm({ ...form, isFixed: e.target.value === "fixed" })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="fixed">Fixed (Annual)</option>
                <option value="accrual">Accrual (Monthly)</option>
              </select>
            </div>
            <Input
              label="Default Days / Year"
              type="number"
              value={String(form.defaultDays)}
              onChange={(e) => setForm({ ...form, defaultDays: Number(e.target.value) })}
              required
            />
            {!form.isFixed && (
              <Input
                label="Accrual / Month"
                type="number"
                step="0.5"
                value={String(form.accrualPerMonth)}
                onChange={(e) => setForm({ ...form, accrualPerMonth: Number(e.target.value) })}
              />
            )}
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <Button type="submit" loading={loading} size="sm">
            {editingId ? "Update" : "Create"} Leave Type
          </Button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Days/Year</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveTypes.map((lt) => (
              <tr key={lt.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{lt.name}</td>
                <td className="py-3 px-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{lt.code}</td>
                <td className="py-3 px-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    lt.isFixed
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  }`}>
                    {lt.isFixed ? "Fixed" : `Accrual (${lt.accrualPerMonth}/mo)`}
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-medium text-gray-700 dark:text-gray-300">{lt.defaultDays}</td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => handleToggleActive(lt)}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                      lt.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {lt.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingId(lt.id);
                        setForm({
                          name: lt.name,
                          code: lt.code,
                          isFixed: lt.isFixed,
                          defaultDays: lt.defaultDays,
                          accrualPerMonth: lt.accrualPerMonth || 0,
                        });
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(lt.id)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaveTypes.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">No leave types yet. Click &quot;Add Leave Type&quot; to create one.</p>
        )}
      </div>
    </Card>
  );
}

// ─── Email Config Tab ─────────────────────────────────────

const EMAIL_PRESETS = {
  gmail: { host: "smtp.gmail.com", port: 587, secure: false },
  microsoft365: { host: "smtp.office365.com", port: 587, secure: false },
  custom: { host: "", port: 587, secure: false },
};

function EmailConfigTab({ config }: { config: EmailConfigData | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState({
    provider: config?.provider || "gmail",
    host: config?.host || "smtp.gmail.com",
    port: config?.port || 587,
    secure: config?.secure || false,
    username: config?.username || "",
    password: "",
    fromName: config?.fromName || "National Group India AttendEase",
    fromEmail: config?.fromEmail || "",
  });

  const handlePresetChange = (provider: string) => {
    const preset = EMAIL_PRESETS[provider as keyof typeof EMAIL_PRESETS] || EMAIL_PRESETS.custom;
    setForm({
      ...form,
      provider,
      host: preset.host || form.host,
      port: preset.port,
      secure: preset.secure,
    });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/settings/email-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: form.host,
          port: form.port,
          secure: form.secure,
          username: form.username,
          password: form.password,
        }),
      });
      const data = await res.json();
      setTestResult({
        ok: data.success,
        message: data.success ? "Connection successful!" : data.error?.message || "Failed",
      });
    } catch {
      setTestResult({ ok: false, message: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/settings/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to save");
        return;
      }
      setSuccess("Email configuration saved successfully!");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Email Configuration</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Configure SMTP settings for sending emails (welcome emails, notifications, etc.)</p>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Provider selection */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Email Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "gmail", label: "Gmail", icon: "G" },
              { key: "microsoft365", label: "Microsoft 365", icon: "M" },
              { key: "custom", label: "Custom SMTP", icon: "⚙" },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePresetChange(p.key)}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  form.provider === p.key
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                }`}
              >
                <span className="text-lg">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* SMTP Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="SMTP Host"
            placeholder="smtp.gmail.com"
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
            required
          />
          <Input
            label="Port"
            type="number"
            placeholder="587"
            value={String(form.port)}
            onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
            required
          />
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Security</label>
            <select
              value={form.secure ? "ssl" : "tls"}
              onChange={(e) => setForm({ ...form, secure: e.target.value === "ssl" })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
            >
              <option value="tls">STARTTLS (Port 587)</option>
              <option value="ssl">SSL/TLS (Port 465)</option>
            </select>
          </div>
        </div>

        {/* Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Username / Email"
            placeholder="your@gmail.com"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <Input
            label="Password / App Password"
            type="password"
            placeholder={config ? "••••••••" : "Enter password"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!config}
          />
        </div>

        {/* From */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="From Name"
            placeholder="National Group India AttendEase"
            value={form.fromName}
            onChange={(e) => setForm({ ...form, fromName: e.target.value })}
          />
          <Input
            label="From Email"
            type="email"
            placeholder="noreply@nationalgroupindia.com"
            value={form.fromEmail}
            onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
            required
          />
        </div>

        {form.provider === "gmail" && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Gmail:</strong> Use an{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">
                App Password
              </a>{" "}
              instead of your regular password. Enable 2-step verification first.
            </p>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div className={`rounded-lg p-3 text-sm ${
            testResult.ok
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
          }`}>
            {testResult.ok ? "✓" : "✗"} {testResult.message}
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleTest} loading={testing}>
            Test Connection
          </Button>
          <Button type="submit" loading={loading}>
            Save Configuration
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── General Settings Tab ─────────────────────────────────

function GeneralTab() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/app-config")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setConfigs(d.data);
      })
      .finally(() => setLoadingConfigs(false));
  }, []);

  const toggleConfig = async (key: string) => {
    const current = configs[key] === "true";
    const newVal = (!current).toString();
    setSavingKey(key);
    try {
      const res = await fetch("/api/settings/app-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: { [key]: newVal } }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigs((prev) => ({ ...prev, [key]: newVal }));
      }
    } catch { /* ignore */ }
    setSavingKey(null);
  };

  const geofenceEnforced = configs["GEOFENCE_ENFORCE"] === "true";

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        General Settings
      </h3>

      {loadingConfigs ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="space-y-4">
            {[
              { label: "Standard Work Hours", desc: "Hours expected per day", key: "STANDARD_WORK_HOURS", suffix: "h" },
              { label: "Late Arrival Threshold", desc: "Time after which arrival is late", key: "LATE_THRESHOLD", suffix: "" },
              { label: "Auto Checkout Hour", desc: "Auto checkout if forgot (24h format)", key: "AUTO_CHECKOUT_HOUR", suffix: ":00" },
              { label: "Default Geofence Radius", desc: "In meters", key: "DEFAULT_GEOFENCE_RADIUS", suffix: "m" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {configs[item.key] || "-"}{item.suffix}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Location & Geofence
            </h3>
            <div className="space-y-3">
              {/* Geofence Enforce Toggle */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Enforce Geofence</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {geofenceEnforced
                      ? "Employees can only check in/out within geofence zones"
                      : "Location is captured but check-in/out is allowed from anywhere"}
                  </p>
                </div>
                <button
                  onClick={() => toggleConfig("GEOFENCE_ENFORCE")}
                  disabled={savingKey === "GEOFENCE_ENFORCE"}
                  className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                    geofenceEnforced ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                  } ${savingKey === "GEOFENCE_ENFORCE" ? "opacity-50" : "cursor-pointer"}`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      geofenceEnforced ? "translate-x-5.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Always capture location info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    GPS location and address are always captured on every check-in and check-out, regardless of this setting.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Email Notifications
            </h3>
            <div className="space-y-3">
              {[
                "Send email on regularization request",
                "Send email on approval/rejection",
                "Daily summary email to managers",
                "Weekly report to HR",
              ].map((label) => (
                <div key={label} className="flex items-center justify-between py-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
                  <div className="w-10 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
