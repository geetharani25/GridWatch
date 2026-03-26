import { create } from 'zustand';

export type SensorStatus = 'healthy' | 'warning' | 'critical' | 'silent';

export interface AppUser {
  id: string;
  email: string;
  role: string;
}

interface AppStore {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
  sensorStates: Map<string, SensorStatus>;
  setSensorState: (sensorId: string, status: SensorStatus) => void;
  initSensorStates: (sensors: Array<{ id: string; status: SensorStatus }>) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  sensorStates: new Map(),
  setSensorState: (sensorId, status) =>
    set(state => {
      const next = new Map(state.sensorStates);
      next.set(sensorId, status);
      return { sensorStates: next };
    }),
  initSensorStates: (sensors) =>
    set({ sensorStates: new Map(sensors.map(s => [s.id, s.status])) }),
}));
