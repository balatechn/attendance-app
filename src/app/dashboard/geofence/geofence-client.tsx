"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge } from "@/components/ui";

interface GeoFence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  isActive: boolean;
}

interface Props {
  geoFences: GeoFence[];
}

export function GeofenceClient({ geoFences }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("200");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editRadius, setEditRadius] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/geofence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          radiusM: parseInt(radius),
        }),
      });
      setName("");
      setLatitude("");
      setLongitude("");
      setRadius("200");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      (err) => alert("Could not get location: " + err.message)
    );
  };

  const startEdit = (fence: GeoFence) => {
    setEditingId(fence.id);
    setEditName(fence.name);
    setEditLat(fence.latitude.toFixed(6));
    setEditLng(fence.longitude.toFixed(6));
    setEditRadius(fence.radiusM.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditLat("");
    setEditLng("");
    setEditRadius("");
  };

  const saveEdit = async (id: string) => {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/geofence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          latitude: parseFloat(editLat),
          longitude: parseFloat(editLng),
          radiusM: parseInt(editRadius),
        }),
      });
      if (res.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setEditLoading(false);
    }
  };

  const toggleActive = async (id: string, currentlyActive: boolean) => {
    setActionLoading(id);
    try {
      await fetch(`/api/geofence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string, fenceName: string) => {
    if (!confirm(`Delete geofence "${fenceName}"? This cannot be undone.`)) return;
    setActionLoading(id);
    try {
      await fetch(`/api/geofence/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const useCurrentLocationForEdit = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditLat(pos.coords.latitude.toFixed(6));
        setEditLng(pos.coords.longitude.toFixed(6));
      },
      (err) => alert("Could not get location: " + err.message)
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Geofence Management
      </h2>

      {/* Add form */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Add New Geofence
        </h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Office, Branch, etc."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="12.9716"
              required
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="77.5946"
              required
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={useCurrentLocation}>
            📍 Use Current Location
          </Button>
          <Input
            label="Radius (meters)"
            type="number"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="200"
          />
          <Button type="submit" loading={loading} className="w-full">
            Add Geofence
          </Button>
        </form>
      </Card>

      {/* Existing geofences */}
      <div className="space-y-3">
        {geoFences.map((fence) => (
          <Card key={fence.id}>
            {editingId === fence.id ? (
              /* Edit mode */
              <div className="space-y-3">
                <Input
                  label="Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Latitude"
                    type="number"
                    step="any"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    required
                  />
                  <Input
                    label="Longitude"
                    type="number"
                    step="any"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    required
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={useCurrentLocationForEdit}>
                  📍 Use Current Location
                </Button>
                <Input
                  label="Radius (meters)"
                  type="number"
                  value={editRadius}
                  onChange={(e) => setEditRadius(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => saveEdit(fence.id)}
                    loading={editLoading}
                    size="sm"
                    className="flex-1"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={cancelEdit}
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {fence.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {fence.latitude.toFixed(6)}, {fence.longitude.toFixed(6)} · {fence.radiusM}m radius
                    </p>
                  </div>
                  <Badge
                    variant={
                      fence.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }
                  >
                    {fence.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => startEdit(fence)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(fence.id, fence.isActive)}
                    disabled={actionLoading === fence.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      fence.isActive
                        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                        : "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {fence.isActive ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                    </svg>
                    {fence.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(fence.id, fence.name)}
                    disabled={actionLoading === fence.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors ml-auto"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}

        {geoFences.length === 0 && (
          <Card>
            <div className="text-center py-6 text-gray-400 dark:text-gray-500">
              <p className="text-sm">No geofences configured yet</p>
              <p className="text-xs mt-1">Add one above to restrict check-in locations</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
