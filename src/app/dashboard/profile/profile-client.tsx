"use client";

import { useState } from "react";
import { Card, Badge, Button, Input } from "@/components/ui";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  designation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  entityId: string | null;
  entityName: string | null;
  locationId: string | null;
  locationName: string | null;
  isActive: boolean;
  memberSince: string;
}

interface SelectOption {
  id: string;
  name: string;
}

interface Props {
  user: ProfileData;
  locations: SelectOption[];
  entities: SelectOption[];
  departments: SelectOption[];
}

export function ProfileClient({ user, locations, entities, departments }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState(user.phone || "");
  const [designation, setDesignation] = useState(user.designation || "");
  const [departmentId, setDepartmentId] = useState(user.departmentId || "");
  const [entityId, setEntityId] = useState(user.entityId || "");
  const [locationId, setLocationId] = useState(user.locationId || "");

  // Derive display values (updated after save)
  const [displayPhone, setDisplayPhone] = useState(user.phone || "");
  const [displayDesignation, setDisplayDesignation] = useState(user.designation || "");
  const [displayDepartmentName, setDisplayDepartmentName] = useState(user.departmentName || "");
  const [displayEntityName, setDisplayEntityName] = useState(user.entityName || "");
  const [displayLocationName, setDisplayLocationName] = useState(user.locationName || "");

  const handleSave = async () => {
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, designation, departmentId, entityId, locationId }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to update profile");
        return;
      }

      // Update display values
      setDisplayPhone(data.data.phone || "");
      setDisplayDesignation(data.data.designation || "");
      setDisplayDepartmentName(data.data.department?.name || "");
      setDisplayEntityName(data.data.entity?.name || "");
      setDisplayLocationName(data.data.location?.name || "");

      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPhone(displayPhone);
    setDesignation(displayDesignation);
    const dept = departments.find((d) => d.name === displayDepartmentName);
    setDepartmentId(dept?.id || "");
    const ent = entities.find((e) => e.name === displayEntityName);
    setEntityId(ent?.id || "");
    const loc = locations.find((l) => l.name === displayLocationName);
    setLocationId(loc?.id || "");
    setEditing(false);
    setError("");
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-2xl">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {user.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
            <Badge className="mt-1">{user.role.replace("_", " ")}</Badge>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            title="Edit profile"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Profile updated successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* Editable: Department */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">Department</span>
          {editing ? (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-48 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 text-right"
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {displayDepartmentName || "—"}
            </span>
          )}
        </div>

        {/* Editable: Designation */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">Designation</span>
          {editing ? (
            <Input
              placeholder="e.g. Senior Engineer"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-48 text-right text-sm"
            />
          ) : (
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {displayDesignation || "—"}
            </span>
          )}
        </div>

        {/* Editable: Entity */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">Entity</span>
          {editing ? (
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-48 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 text-right"
            >
              <option value="">Select Entity</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {displayEntityName || "—"}
            </span>
          )}
        </div>

        {/* Editable: Location */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">Location</span>
          {editing ? (
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-48 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 text-right"
            >
              <option value="">Select Location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {displayLocationName || "—"}
            </span>
          )}
        </div>

        {/* Editable: Phone */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
          {editing ? (
            <Input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-48 text-right text-sm"
            />
          ) : (
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {displayPhone || "—"}
            </span>
          )}
        </div>

        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
          <Badge
            variant={
              user.isActive
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }
          >
            {user.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <div className="flex justify-between py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Member since</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {user.memberSince}
          </span>
        </div>
      </div>

      {editing && (
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">
            Save Changes
          </Button>
        </div>
      )}
    </Card>
  );
}
