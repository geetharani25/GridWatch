import client from './client';

export const getSensors = () => client.get('/sensors').then(r => r.data);

export const getSensor = (id: string) => client.get(`/sensors/${id}`).then(r => r.data);

export const getSensorHistory = (id: string, params: Record<string, string>) =>
  client.get(`/sensors/${id}/history`, { params }).then(r => r.data);
