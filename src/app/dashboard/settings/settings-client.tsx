"use client";

import { useState } from "react";
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

interface Props {
  departments: Department[];
  entities: Entity[];
  emailConfig: EmailConfigData | null;
}

type Tab = "departments" | "entities" | "email" | "general";

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

export function SettingsClient({ departments, entities, emailConfig }: Props) {
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
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        General Settings
      </h3>
      <div className="space-y-4">
        {[
          { label: "Standard Work Hours", desc: "Hours expected per day", value: "8h" },
          { label: "Late Arrival Threshold", desc: "Time after which arrival is late", value: "09:30" },
          { label: "Auto Checkout", desc: "Auto checkout if forgot", value: "11:00 PM" },
          { label: "Default Geofence Radius", desc: "In meters", value: "200m" },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</span>
          </div>
        ))}
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
    </Card>
  );
}
