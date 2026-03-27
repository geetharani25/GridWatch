import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSensor } from '../api/sensors';
import { useSensorHistory } from '../hooks/useSensorHistory';
import { ReadingsChart } from '../components/sensors/ReadingsChart';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

const statusClass: Record<string, string> = {
  healthy:  'bg-green-100 text-green-800',
  warning:  'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
  silent:   'bg-slate-100 text-slate-500',
};

export default function SensorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    to:   new Date().toISOString(),
  });
  const [page, setPage] = useState(1);

  const { data: sensor } = useQuery({
    queryKey: ['sensor', id],
    queryFn: () => getSensor(id!),
  });

  const { data: history, isLoading, error } = useSensorHistory(
    id!, dateRange.from, dateRange.to, page
  );

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link to="/" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      </div>

      {sensor && (
        <div className="mb-6 flex items-start gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{sensor.name}</h1>
            <p className="text-sm text-slate-500">{sensor.location}</p>
          </div>
          <div className="flex gap-2 mt-1">
            <Badge className={statusClass[sensor.status] ?? ''}>{sensor.status}</Badge>
            {sensor.is_suppressed && <Badge className="bg-slate-100 text-slate-600">suppressed</Badge>}
            {sensor.open_alert_id && (
              <Badge className="bg-red-100 text-red-800">
                open alert: {sensor.open_alert_severity}
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-base font-medium text-slate-700 mb-4">
          Readings (last 7 days)
          {history && <span className="text-sm font-normal text-slate-400 ml-2">— {history.total} total</span>}
        </h2>

        {isLoading && <p className="text-slate-400 text-sm">Loading readings...</p>}
        {error && <p className="text-red-500 text-sm">Error: {(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'Failed to load readings'}</p>}
        {history && <ReadingsChart readings={history.readings} />}

        {history && history.pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Prev
            </Button>
            <span className="text-sm text-slate-500">Page {page} / {history.pages}</span>
            <Button size="sm" variant="outline" disabled={page >= history.pages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
