"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: true, // Start true since we auto-request on mount
    error: null,
  });
  const watchId = useRef<number | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported by your browser", loading: false }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          loading: false,
          error: null,
        });
      },
      (err) => {
        let errorMsg = "Location access denied";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMsg = "Location permission denied. Please allow location access in your browser settings.";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMsg = "Location unavailable. Please check your device GPS settings.";
            break;
          case err.TIMEOUT:
            errorMsg = "Location request timed out. Please try again.";
            break;
        }
        setState((s) => ({
          ...s,
          loading: false,
          error: errorMsg,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 30000, // Allow cached position up to 30s old
      }
    );
  }, []);

  // Auto-request on mount + keep watching for position updates
  useEffect(() => {
    requestLocation();

    // Also start a watch for continuous updates
    if (typeof window !== "undefined" && navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          setState({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            loading: false,
            error: null,
          });
        },
        () => {
          // Silently ignore watch errors — we already handle them in requestLocation
        },
        {
          enableHighAccuracy: false, // Use low accuracy for background updates
          timeout: 30000,
          maximumAge: 60000,
        }
      );
    }

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [requestLocation]);

  return { ...state, refresh: requestLocation };
}
