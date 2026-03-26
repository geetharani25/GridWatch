interface AlertFiltersProps {
  filters: Record<string, string>;
  onChange: (filters: Record<string, string>) => void;
}

export function AlertFilters({ filters, onChange }: AlertFiltersProps) {
  const set = (key: string, value: string) =>
    onChange({ ...filters, [key]: value, page: '1' });

  return (
    <div className="flex gap-3 mb-4">
      <select
        value={filters.status ?? ''}
        onChange={e => set('status', e.target.value)}
        className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="resolved">Resolved</option>
      </select>

      <select
        value={filters.severity ?? ''}
        onChange={e => set('severity', e.target.value)}
        className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        <option value="">All severities</option>
        <option value="critical">Critical</option>
        <option value="warning">Warning</option>
      </select>
    </div>
  );
}
