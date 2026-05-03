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

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 20000);

    let res;
    try {
      res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError')
        throw new Error('La solicitud tardó demasiado. Verifica que la API esté activa.');
      throw new Error('No se pudo conectar con el servidor. Verifica que la API esté activa.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 401) {
      logoutRef.current();
      window.location.href = '/login';
      throw new Error('Sesión expirada — redirigiendo al login');
    }

    // Guard against HTML error pages (proxy errors, unmatched routes, etc.)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && !contentType.includes('text/csv')) {
      const text = await res.text();
      throw new Error(`El servidor devolvió una respuesta inesperada (${res.status}): ${text.substring(0, 120)}`);
    }

    return res;
  }, []); // stable — never recreated

  return { apiFetch };
}
