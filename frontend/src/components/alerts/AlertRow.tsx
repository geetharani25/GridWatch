import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useTransitionAlert } from '../../hooks/useAlerts';
import { Link } from 'react-router-dom';

interface AlertRowProps {
  alert: {
    id: string;
    sensor_id: string;
    sensor_name: string;
    severity: string;
    status: string;
    suppressed: boolean;
    opened_at: string;
    acknowledged_at: string | null;
    escalated_at: string | null;
  };
}

const severityClass: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  warning:  'bg-amber-100 text-amber-800',
};

const statusClass: Record<string, string> = {
  open:         'bg-blue-100 text-blue-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  resolved:     'bg-green-100 text-green-800',
};

export function AlertRow({ alert }: AlertRowProps) {
  const { mutate: transition, isPending } = useTransitionAlert();

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 text-sm">
        <Link to={`/sensors/${alert.sensor_id}`} className="text-blue-600 hover:underline">
          {alert.sensor_name}
        </Link>
      </td>
      <td className="px-4 py-3">
        <Badge className={severityClass[alert.severity] ?? ''}>{alert.severity}</Badge>
        {alert.suppressed && <span className="ml-1 text-xs text-slate-400">(suppressed)</span>}
      </td>
      <td className="px-4 py-3">
        <Badge className={statusClass[alert.status] ?? ''}>{alert.status}</Badge>
        {alert.escalated_at && <span className="ml-1 text-xs text-red-500">⚑ escalated</span>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {new Date(alert.opened_at).toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {alert.status === 'open' && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => transition({ id: alert.id, status: 'acknowledged' })}
            >
              Ack
            </Button>
          )}
          {(alert.status === 'open' || alert.status === 'acknowledged') && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => transition({ id: alert.id, status: 'resolved' })}
            >
              Resolve
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
