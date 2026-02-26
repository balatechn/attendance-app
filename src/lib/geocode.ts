/**
 * Reverse geocode coordinates to a human-readable address using
 * OpenStreetMap's Nominatim API (free, no API key required).
 *
 * Falls back gracefully to lat/lng if the service is unavailable.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AttendEase/1.0 (attendance-app)",
        Accept: "application/json",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    const data = await response.json();

    if (data.display_name) {
      // Shorten address: take first 3-4 meaningful parts
      const parts = data.display_name.split(", ");
      // Remove very generic parts like country code, zip
      const meaningful = parts.slice(0, Math.min(parts.length, 4));
      return meaningful.join(", ");
    }

    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    // Silently fallback — don't block attendance
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}
