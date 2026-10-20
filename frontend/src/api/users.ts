import api from './client';

export interface ManagedUser {
  id: number;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  protected: boolean; // in ADMIN_EMAILS: can't be changed or deleted here
  inactive: boolean; // view-only
  created_at: string;
  last_login: string | null;
  assignments: { key: string; name: string; base: string }[];
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const response = await api.get('/users');
  return response.data;
}

export async function setInactive(id: number, inactive: boolean): Promise<unknown> {
  const response = await api.patch(`/users/${id}`, { inactive });
  return response.data;
}

export async function deleteUser(id: number): Promise<unknown> {
  const response = await api.delete(`/users/${id}`);
  return response.data;
}
