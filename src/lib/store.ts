import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AttendanceState {
  isCheckedIn: boolean;
  currentSessionStart: string | null; // ISO string
  elapsedSeconds: number;
  lastLocation: { lat: number; lng: number } | null;
  offlineQueue: Array<{
    type: "CHECK_IN" | "CHECK_OUT";
    timestamp: string;
    latitude: number;
    longitude: number;
    deviceInfo?: string;
  }>;

  // Actions
  checkIn: (lat: number, lng: number) => void;
  checkOut: () => void;
  setElapsedSeconds: (seconds: number) => void;
  addToOfflineQueue: (entry: AttendanceState["offlineQueue"][0]) => void;
  clearOfflineQueue: () => void;
  reset: () => void;
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set) => ({
      isCheckedIn: false,
      currentSessionStart: null,
      elapsedSeconds: 0,
      lastLocation: null,
      offlineQueue: [],

      checkIn: (lat, lng) =>
        set({
          isCheckedIn: true,
          currentSessionStart: new Date().toISOString(),
          lastLocation: { lat, lng },
          elapsedSeconds: 0,
        }),

      checkOut: () =>
        set({
          isCheckedIn: false,
          currentSessionStart: null,
          elapsedSeconds: 0,
        }),

      setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),

      addToOfflineQueue: (entry) =>
        set((state) => ({
          offlineQueue: [...state.offlineQueue, entry],
        })),

      clearOfflineQueue: () => set({ offlineQueue: [] }),

      reset: () =>
        set({
          isCheckedIn: false,
          currentSessionStart: null,
          elapsedSeconds: 0,
          lastLocation: null,
        }),
    }),
    {
      name: "attendance-store",
      partialize: (state) => ({
        isCheckedIn: state.isCheckedIn,
        currentSessionStart: state.currentSessionStart,
        lastLocation: state.lastLocation,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);

// UI State Store
interface UIState {
  isDarkMode: boolean;
  sidebarOpen: boolean;
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isDarkMode: false,
      sidebarOpen: false,
      toggleDarkMode: () =>
        set((state) => {
          const newVal = !state.isDarkMode;
          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", newVal);
          }
          return { isDarkMode: newVal };
        }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),
    }),
    {
      name: "ui-store",
      partialize: (state) => ({ isDarkMode: state.isDarkMode }),
    }
  )
);
