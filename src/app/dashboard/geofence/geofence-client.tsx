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
            <div className="flex items-center justify-between">
              <div>
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
                    : "bg-gray-100 text-gray-500"
                }
              >
                {fence.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
