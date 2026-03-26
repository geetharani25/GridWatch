import { AlertRow } from './AlertRow';

interface AlertTableProps {
  alerts: Array<{
    id: string;
    sensor_id: string;
    sensor_name: string;
    severity: string;
    status: string;
    suppressed: boolean;
    opened_at: string;
    acknowledged_at: string | null;
    escalated_at: string | null;
  }>;
  isLoading: boolean;
}

export function AlertTable({ alerts, isLoading }: AlertTableProps) {
  if (isLoading) return <p className="text-slate-500 py-4">Loading alerts...</p>;
  if (!alerts.length) return <p className="text-slate-400 py-4">No alerts found.</p>;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-3 text-left font-medium text-slate-600">Sensor</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Severity</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Opened</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map(alert => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
