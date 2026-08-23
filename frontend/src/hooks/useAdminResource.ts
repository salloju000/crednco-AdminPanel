import { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchRecord } from './types';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastSeq = 0;

function applyOptimisticUpdate(
  prev: SearchRecord[],
  id: string,
  approved: boolean
): SearchRecord[] {
  return prev.map((s) => {
    if (s.id !== id) return s;
    return {
      ...s,
      metadata: {
        ...s.metadata,
        prediction: {
          ...s.metadata?.prediction,
          approved,
        },
      },
    };
  });
}

export interface UseAdminResourceOptions {
  /** URL path segment under /admin/, e.g. "applications" or "searches". */
  resourcePath: 'applications' | 'searches';
  /** Prefix used in console debug/error logs, e.g. "[useApplications]". */
  logPrefix: string;
}

/**
 * Shared polling + optimistic-action data hook for the /admin/{applications,searches}
 * list endpoints. useApplications and useSearches were previously two
 * byte-for-byte-identical copies of this logic (differing only in the
 * endpoint path and variable names) — this is the single implementation
 * both now wrap.
 */
export function useAdminResource(
  authToken: string | null,
  onUnauthorized: (() => void) | undefined,
  { resourcePath, logPrefix }: UseAdminResourceOptions
) {
  const [items, setItems]                 = useState<SearchRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [toasts, setToasts]               = useState<Toast[]>([]);
  const abortRef                          = useRef<AbortController | null>(null);

  const adminHeaders = useCallback((): HeadersInit => {
    return authToken ? { 'Authorization': `Bearer ${authToken}` } : ({} as Record<string, string>);
  }, [authToken]);

  const pushToast = useCallback((message: string, type: Toast['type']) => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // Every 30s poll otherwise produces a brand-new array reference via
  // JSON.parse even when the underlying data hasn't changed, defeating
  // React.memo on every component this list is passed to. Keep the
  // previous reference when the content is identical.
  const setItemsIfChanged = useCallback((next: SearchRecord[]) => {
    setItems((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  const fetchItems = useCallback(async (): Promise<SearchRecord[]> => {
    if (!authToken) {
      console.warn(`${logPrefix} missing authToken, skipping fetch`);
      return [];
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl || apiUrl === 'undefined') {
      console.error(`${logPrefix} invalid API URL:`, apiUrl);
      throw new Error('API URL is not configured.');
    }

    const url = `${apiUrl}/admin/${resourcePath}`;
    const headers = adminHeaders();
    console.debug(`${logPrefix} fetching ${resourcePath}`, { url });

    try {
      setLoading(true);
      const res = await fetch(url, {
        headers,
        signal: ctrl.signal,
      });

      const text = await res.text();
      console.debug(`${logPrefix} raw response`, { status: res.status, statusText: res.statusText });

      if (!res.ok) {
        if (res.status === 401 && onUnauthorized) {
          onUnauthorized();
        }
        let message = `Server returned HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.detail) {
            message = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
          }
        } catch {
          // ignore invalid JSON in error response
        }
        throw new Error(message);
      }

      if (!text) {
        console.debug(`${logPrefix} empty response body, setting ${resourcePath} to []`);
        setItemsIfChanged([]);
        setError(null);
        setLastRefreshed(new Date());
        return [];
      }

      try {
        const data: SearchRecord[] = JSON.parse(text);
        console.debug(`${logPrefix} parsed response data`, { count: data.length });
        setItemsIfChanged(data);
        setError(null);
        setLastRefreshed(new Date());
        return data;
      } catch (parseError) {
        console.error(`${logPrefix} failed to parse JSON response`, parseError);
        throw new Error('Invalid JSON response from server');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return [];
      console.error(`${logPrefix} fetch error`, err);
      setError(getErrorMessage(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, [authToken, adminHeaders, resourcePath, logPrefix, setItemsIfChanged]);

  useEffect(() => {
    if (!authToken) return;
    fetchItems();
    const id = setInterval(fetchItems, 30_000);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchItems, authToken]);

  const handleAction = useCallback(
    async (
      id: string,
      action: 'approve' | 'reject',
      onSelectedSync: (fresh: SearchRecord[]) => void
    ) => {
      if (!authToken) {
        console.warn(`${logPrefix} missing authToken, skipping handleAction`);
        return;
      }

      const url = `${import.meta.env.VITE_API_URL}/admin/${resourcePath}/${id}/${action}`;
      const headers = adminHeaders();
      console.debug(`${logPrefix} performing action`, { id, action, url });

      setItems((prev) => applyOptimisticUpdate(prev, id, action === 'approve'));
      setActionLoading(true);
      try {
        const res = await fetch(url, { method: 'POST', headers });
        console.debug(`${logPrefix} action response`, { status: res.status, statusText: res.statusText });
        if (!res.ok) {
          if (res.status === 401 && onUnauthorized) {
            onUnauthorized();
          }
          throw new Error(`HTTP ${res.status}`);
        }

        const fresh = await fetchItems();
        onSelectedSync(fresh);

        pushToast(
          action === 'approve' ? 'Application approved.' : 'Application rejected.',
          'success'
        );
      } catch (err: unknown) {
        console.error(`${logPrefix} handleAction failed`, err);
        await fetchItems();
        pushToast(`Action failed: ${getErrorMessage(err)}`, 'error');
      } finally {
        setActionLoading(false);
      }
    },
    [fetchItems, pushToast, authToken, adminHeaders, resourcePath, logPrefix]
  );

  return {
    items,
    loading,
    error,
    actionLoading,
    lastRefreshed,
    toasts,
    fetchItems,
    handleAction,
  };
}
