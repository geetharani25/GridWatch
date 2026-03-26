import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { SensorGrid } from '../components/dashboard/SensorGrid';
import { getSensors } from '../api/sensors';

export default function DashboardPage() {
  const initSensorStates = useAppStore(s => s.initSensorStates);

  const { data: sensors, isLoading } = useQuery({
    queryKey: ['sensors'],
    queryFn: getSensors,
  });

  useEffect(() => {
    if (sensors) initSensorStates(sensors);
  }, [sensors, initSensorStates]);

  const counts = sensors ? {
    total:    sensors.length,
    critical: sensors.filter((s: { status: string }) => s.status === 'critical').length,
    warning:  sensors.filter((s: { status: string }) => s.status === 'warning').length,
    silent:   sensors.filter((s: { status: string }) => s.status === 'silent').length,
  } : null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Sensor Dashboard</h1>
        {counts && (
          <div className="flex gap-3 text-sm">
            <span className="text-slate-500">{counts.total} sensors</span>
            {counts.critical > 0 && <span className="text-red-600 font-medium">{counts.critical} critical</span>}
            {counts.warning > 0  && <span className="text-amber-600 font-medium">{counts.warning} warning</span>}
            {counts.silent > 0   && <span className="text-slate-400">{counts.silent} silent</span>}
          </div>
        )}
      </div>

      {isLoading && <p className="text-slate-500">Loading sensors...</p>}
      {sensors && <SensorGrid sensors={sensors} />}
    </div>
  );
}
