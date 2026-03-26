import { Link } from 'react-router-dom';
import { useAppStore, type SensorStatus } from '../../store/useAppStore';
import { Badge } from '../ui/badge';

const statusConfig: Record<SensorStatus, { className: string; label: string }> = {
  healthy:  { className: 'bg-green-100 text-green-800',   label: 'OK' },
  warning:  { className: 'bg-amber-100 text-amber-800',   label: 'WARN' },
  critical: { className: 'bg-red-100 text-red-800',       label: 'CRIT' },
  silent:   { className: 'bg-slate-100 text-slate-500',   label: 'SILENT' },
};

interface SensorTileProps {
  sensor: { id: string; name: string };
}

export function SensorTile({ sensor }: SensorTileProps) {
  // Selector-scoped: only re-renders when THIS sensor's state changes
  const status = useAppStore(s => s.sensorStates.get(sensor.id) ?? 'healthy');
  const cfg = statusConfig[status] ?? statusConfig.healthy;

  return (
    <Link
      to={`/sensors/${sensor.id}`}
      className="block p-2 border border-slate-200 rounded bg-white hover:shadow-sm transition-shadow"
    >
      <div className="text-xs text-slate-500 truncate mb-1">{sensor.name}</div>
      <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
    </Link>
  );
}
