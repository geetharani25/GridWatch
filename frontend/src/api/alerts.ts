import client from './client';

export const getAlerts = (params: Record<string, string>) =>
  client.get('/alerts', { params }).then(r => r.data);

export const transitionAlert = (id: string, status: string) =>
  client.patch(`/alerts/${id}`, { status }).then(r => r.data);

export const getAlertTransitions = (id: string) =>
  client.get(`/alerts/${id}/transitions`).then(r => r.data);
