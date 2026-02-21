/**
 * Calculate the distance between two geographic points using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Check if user is within any active geofence.
 */
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  fences: { latitude: number; longitude: number; radiusM: number }[]
): { allowed: boolean; nearestDistance: number } {
  if (fences.length === 0) return { allowed: true, nearestDistance: 0 };

  let minDistance = Infinity;
  let allowed = false;

  for (const fence of fences) {
    const distance = haversineDistance(
      userLat,
      userLon,
      fence.latitude,
      fence.longitude
    );
    if (distance < minDistance) minDistance = distance;
    if (distance <= fence.radiusM) {
      allowed = true;
    }
  }

  return { allowed, nearestDistance: Math.round(minDistance) };
}

/**
 * Get current position as a Promise wrapper around navigator.geolocation.
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}
