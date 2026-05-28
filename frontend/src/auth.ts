// Tiny shared-login token store. The token comes from POST /api/login and is
// attached to every API request by the axios interceptor in api/client.ts.
const KEY = 'grid_token';

// Dispatched when a 401 is seen (token missing/expired); App listens and shows login.
export const LOGOUT_EVENT = 'auth:logout';

export const getToken = (): string | null => localStorage.getItem(KEY);

export const setToken = (token: string): void => localStorage.setItem(KEY, token);

export const clearToken = (): void => {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(LOGOUT_EVENT));
};
