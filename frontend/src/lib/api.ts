export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4100';

export type ApiError = { error: string; details?: unknown };

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  if (!res.ok) {
    let data: any = null;
    try { data = await res.json(); } catch {}
    const err: ApiError = data?.error ? data : { error: `HTTP ${res.status}` };
    throw err;
  }

  return res.json() as Promise<T>;
}

export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
