import client from './client';

export const login = (email: string, password: string) =>
  client.post('/auth/login', { email, password }).then(r => r.data);
