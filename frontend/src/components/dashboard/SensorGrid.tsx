import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SensorTile } from './SensorTile';

const COLS = 6;
const TILE_HEIGHT = 64;

interface SensorGridProps {
  sensors: Array<{ id: string; name: string }>;
}

export function SensorGrid({ sensors }: SensorGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Group sensors into rows
  const rows: Array<typeof sensors> = [];
  for (let i = 0; i < sensors.length; i += COLS) {
    rows.push(sensors.slice(i, i + COLS));
  }

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => TILE_HEIGHT + 8,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - 120px)' }}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div className="grid gap-2 pr-2" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
              {rows[virtualRow.index].map(s => (
                <SensorTile key={s.id} sensor={s} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
