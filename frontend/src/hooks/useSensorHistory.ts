import { useQuery } from '@tanstack/react-query';
import { getSensorHistory } from '../api/sensors';

export function useSensorHistory(sensorId: string, from: string, to: string, page: number) {
  return useQuery({
    queryKey: ['sensor-history', sensorId, from, to, page],
    queryFn: () => getSensorHistory(sensorId, { from, to, page: String(page) }),
    placeholderData: (prev) => prev,
  });
}
