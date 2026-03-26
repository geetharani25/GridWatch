import { useState } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { AlertFilters } from '../components/alerts/AlertFilters';
import { AlertTable } from '../components/alerts/AlertTable';
import { Button } from '../components/ui/button';

export default function AlertPanelPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ status: 'open', page: '1' });
  const { data, isLoading } = useAlerts(filters);

  const currentPage = Number(filters.page ?? '1');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">Alert Management</h1>
      <AlertFilters filters={filters} onChange={setFilters} />
      <AlertTable alerts={data?.alerts ?? []} isLoading={isLoading} />

      {data && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            {data.alerts.length} alerts shown
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setFilters(f => ({ ...f, page: String(currentPage - 1) }))}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm text-slate-600">Page {currentPage}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={data.alerts.length < data.limit}
              onClick={() => setFilters(f => ({ ...f, page: String(currentPage + 1) }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
