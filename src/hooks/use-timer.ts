"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAttendanceStore } from "@/lib/store";

/**
 * Live session timer hook: updates elapsed seconds when checked in.
 */
export function useLiveTimer() {
  const { isCheckedIn, currentSessionStart, elapsedSeconds, setElapsedSeconds } =
    useAttendanceStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isCheckedIn && currentSessionStart) {
      const startTime = new Date(currentSessionStart).getTime();

      const tick = () => {
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - startTime) / 1000));
      };

      tick(); // Immediate first tick
      intervalRef.current = setInterval(tick, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsedSeconds(0);
    }
  }, [isCheckedIn, currentSessionStart, setElapsedSeconds]);

  return {
    isRunning: isCheckedIn,
    elapsedSeconds,
    formatted: formatTimer(elapsedSeconds),
  };
}

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Offline sync hook: retries queued actions when connection returns.
 */
export function useOfflineSync() {
  const { offlineQueue, clearOfflineQueue } = useAttendanceStore();

  const syncQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;

    try {
      const res = await fetch("/api/attendance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: offlineQueue }),
      });

      if (res.ok) {
        clearOfflineQueue();
      }
    } catch {
      // Will retry when back online
    }
  }, [offlineQueue, clearOfflineQueue]);

  useEffect(() => {
    const handleOnline = () => syncQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncQueue]);

  // Try syncing on mount if online
  useEffect(() => {
    if (navigator.onLine && offlineQueue.length > 0) {
      syncQueue();
    }
  }, [syncQueue, offlineQueue.length]);

  return { pendingCount: offlineQueue.length };
}
