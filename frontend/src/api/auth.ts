import { useQuery } from '@tanstack/react-query';
import api from './client';

export interface User {
  email: string;
  name: string | null;
  role: 'host' | 'user';
}

interface Me {
  user: User | null;
  google_client_id: string | null;
}

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Me>('/auth/me')).data,
    staleTime: Infinity,
  });

export const loginWithGoogle = (credential: string) =>
  api.post('/auth/google', { credential });

export const logout = () => api.post('/auth/logout');
