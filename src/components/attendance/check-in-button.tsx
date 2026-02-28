"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useAttendanceStore } from "@/lib/store";
import { useLiveTimer } from "@/hooks/use-timer";

const LOCATION_PING_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function CheckInOutButton({ onSessionChange }: { onSessionChange?: () => void }) {
  const { isCheckedIn, checkIn, checkOut, addToOfflineQueue } = useAttendanceStore();
  const { latitude, longitude, accuracy, loading: geoLoading, error: geoError, refresh } = useGeolocation();
  const { formatted } = useLiveTimer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-retry geolocation if it fails (up to 3 times)
  useEffect(() => {
    if (geoError && retryCount < 3 && !latitude) {
      const timer = setTimeout(() => {
        refresh();
        setRetryCount((c) => c + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [geoError, retryCount, refresh, latitude]);

  // Periodic location ping while checked in (every 5 minutes)
  useEffect(() => {
    if (!isCheckedIn || !latitude || !longitude) {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      return;
    }

    const sendPing = async () => {
      try {
        if (!navigator.onLine) return;
        // Get fresh position for ping
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000,
          });
        });
        await fetch("/api/attendance/location-ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        });
      } catch {
        // Silently ignore ping failures
      }
    };

    // Send first ping after 1 minute, then every 5 minutes
    const firstPingTimer = setTimeout(() => {
      sendPing();
      pingIntervalRef.current = setInterval(sendPing, LOCATION_PING_INTERVAL);
    }, 60_000); // 1 minute initial delay

    return () => {
      clearTimeout(firstPingTimer);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };

  }, [isCheckedIn, latitude, longitude]);

  const hasLocation = latitude !== null && longitude !== null;

  const handleAction = useCallback(async () => {
    setError(null);

    if (!hasLocation) {
      refresh();
      setRetryCount(0);
      setError("Getting your location... Please wait and try again.");
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
        onSessionChange?.();
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
      onSessionChange?.();
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
      onSessionChange?.();
    } finally {
      setLoading(false);
    }
  }, [hasLocation, latitude, longitude, isCheckedIn, refresh, checkIn, checkOut, addToOfflineQueue, onSessionChange]);

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

      {/* Location status indicator */}
      {!hasLocation && !geoLoading && geoError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Location required</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-500">{geoError}</p>
          </div>
          <button 
            onClick={() => { refresh(); setRetryCount(0); }}
            className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {geoLoading && !hasLocation && (
        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Getting your location...
        </div>
      )}

      {hasLocation && !isCheckedIn && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Location ready{accuracy ? ` (±${Math.round(accuracy)}m)` : ""}
        </div>
      )}

      {/* Floating action button */}
      <button
        onClick={handleAction}
        disabled={loading || (geoLoading && !hasLocation)}
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
        {loading || (geoLoading && !hasLocation) ? (
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
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 max-w-xs">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
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
