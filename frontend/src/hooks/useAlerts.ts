import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlerts, transitionAlert } from '../api/alerts';

export function useAlerts(filters: Record<string, string>) {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => getAlerts(filters),
    refetchInterval: 30_000,
  });
}

export function useTransitionAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      transitionAlert(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
