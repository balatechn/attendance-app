"use client";

import { useState, useCallback } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useAttendanceStore } from "@/lib/store";
import { useLiveTimer } from "@/hooks/use-timer";

export function CheckInOutButton() {
  const { isCheckedIn, checkIn, checkOut, addToOfflineQueue } = useAttendanceStore();
  const { latitude, longitude, loading: geoLoading, error: geoError, refresh } = useGeolocation();
  const { formatted } = useLiveTimer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  const handleAction = useCallback(async () => {
    setError(null);

    if (!latitude || !longitude) {
      refresh();
      setError("Please enable location access");
      return;
    }

    setLoading(true);
    const type = isCheckedIn ? "CHECK_OUT" : "CHECK_IN";

    try {
      const deviceInfo = navigator.userAgent;

      // Check if offline
      if (!navigator.onLine) {
        addToOfflineQueue({
          type,
          timestamp: new Date().toISOString(),
          latitude,
          longitude,
          deviceInfo,
        });
        if (type === "CHECK_IN") checkIn(latitude, longitude);
        else checkOut();
        return;
      }

      const res = await fetch("/api/attendance/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, latitude, longitude, deviceInfo }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Failed to process");
        return;
      }

      if (type === "CHECK_IN") {
        checkIn(latitude, longitude);
        setShowMap(true);
        setTimeout(() => setShowMap(false), 5000);
      } else {
        checkOut();
      }
    } catch {
      // Offline fallback
      addToOfflineQueue({
        type,
        timestamp: new Date().toISOString(),
        latitude,
        longitude,
      });
      if (type === "CHECK_IN") checkIn(latitude, longitude);
      else checkOut();
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, isCheckedIn, refresh, checkIn, checkOut, addToOfflineQueue]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Timer display */}
      {isCheckedIn && (
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Current session
          </p>
          <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
            {formatted}
          </p>
        </div>
      )}

      {/* Floating action button */}
      <button
        onClick={handleAction}
        disabled={loading || geoLoading}
        className={`
          relative w-20 h-20 rounded-full shadow-lg font-semibold text-white text-sm
          transition-all duration-300 active:scale-95
          disabled:opacity-50 disabled:pointer-events-none
          ${
            isCheckedIn
              ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-200 dark:shadow-red-900/30"
              : "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-green-200 dark:shadow-green-900/30"
          }
        `}
      >
        {loading || geoLoading ? (
          <svg className="animate-spin h-6 w-6 mx-auto" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : isCheckedIn ? (
          <div className="flex flex-col items-center">
            <svg className="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
            </svg>
            <span className="text-[10px]">Check Out</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg className="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
            </svg>
            <span className="text-[10px]">Check In</span>
          </div>
        )}

        {/* Pulse ring when checked in */}
        {isCheckedIn && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-20" />
        )}
      </button>

      {/* Error message */}
      {(error || geoError) && (
        <p className="text-xs text-red-500 text-center max-w-[200px]">
          {error || geoError}
        </p>
      )}

      {/* Mini map preview */}
      {showMap && latitude && longitude && (
        <div className="w-full max-w-sm rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
          <img
            src={`https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=16&size=400x200&markers=color:green%7C${latitude},${longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`}
            alt="Check-in location"
            className="w-full h-32 object-cover"
            loading="lazy"
          />
          <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20">
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">
              ✓ Checked in at {new Date().toLocaleTimeString()}
            </p>
            <p className="text-[10px] text-green-600/70 dark:text-green-500/70">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
