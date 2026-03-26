import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, type SensorStatus } from '../store/useAppStore';

export function useSSE() {
  const setSensorState = useAppStore(s => s.setSensorState);
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const retryDelay = useRef(1000);

  function connect() {
    const token = localStorage.getItem('gw_token');
    if (!token) return;
    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      retryDelay.current = 1000;

      if (event.type === 'sensor_state_change') {
        setSensorState(event.payload.sensor_id, event.payload.new_status as SensorStatus);
      } else if (event.type === 'alert_created' || event.type === 'alert_updated' || event.type === 'escalation') {
        queryClient.invalidateQueries({ queryKey: ['alerts'] });
      }
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => connect(), Math.min(retryDelay.current, 30_000));
      retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    };

    esRef.current = es;
  }

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
