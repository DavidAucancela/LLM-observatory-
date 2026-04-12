import { useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Hook that wraps fetch() with automatic Authorization header injection.
 * If the API returns 401, clears auth and redirects to /login.
 *
 * apiFetch is a stable reference (never changes between renders) — safe to
 * use in useEffect dependency arrays without causing infinite loops.
 */
export function useApi() {
  const { token, logout } = useAuth();

  // Keep mutable refs so the stable apiFetch callback always reads the latest values
  const tokenRef = useRef(token);
  const logoutRef = useRef(logout);

  useEffect(() => {
    tokenRef.current = token;
    logoutRef.current = logout;
  });

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {})
    };

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (res.status === 401) {
      logoutRef.current();
      window.location.href = '/login';
      throw new Error('Sesión expirada — redirigiendo al login');
    }

    return res;
  }, []); // stable — never recreated

  return { apiFetch };
}
