import { useState, useCallback, useEffect, useRef } from 'react';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

export interface UserStats {
  total_users: number;
  unique_emails: number;
  repeated_users: number;
  emails: string[];
}

export function useUserStats(authToken: string | null, onUnauthorized?: () => void) {
  const [userStats, setUserStats] = useState<UserStats>({
    total_users: 0,
    unique_emails: 0,
    repeated_users: 0,
    emails: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const adminHeaders = useCallback((): HeadersInit => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : ({} as Record<string, string>);
  }, [authToken]);

  // Avoid manufacturing a new object reference (and defeating React.memo on
  // consumers) when a refetch returns data identical to the current state.
  const setUserStatsIfChanged = useCallback((next: UserStats) => {
    setUserStats((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  const fetchUserStats = useCallback(async (): Promise<UserStats> => {
    if (!authToken) {
      console.warn('[useUserStats] missing authToken, skipping fetchUserStats');
      return {
        total_users: 0,
        unique_emails: 0,
        repeated_users: 0,
        emails: [],
      };
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl || apiUrl === 'undefined') {
      console.error('[useUserStats] invalid API URL:', apiUrl);
      throw new Error('API URL is not configured.');
    }

    const url = `${apiUrl}/admin/user-stats`;
    const headers = adminHeaders();

    try {
      setLoading(true);
      const res = await fetch(url, {
        headers,
        signal: ctrl.signal,
      });

      const text = await res.text();
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
        const emptyStats = {
          total_users: 0,
          unique_emails: 0,
          repeated_users: 0,
          emails: [],
        };
        setUserStatsIfChanged(emptyStats);
        setError(null);
        return emptyStats;
      }

      try {
        const data: UserStats = JSON.parse(text);
        setUserStatsIfChanged(data);
        setError(null);
        return data;
      } catch (parseError) {
        console.error('[useUserStats] failed to parse JSON response', parseError, text);
        throw new Error('Invalid JSON response from server');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          total_users: 0,
          unique_emails: 0,
          repeated_users: 0,
          emails: [],
        };
      }
      console.error('[useUserStats] fetchUserStats error', err);
      setError(getErrorMessage(err));
      return {
        total_users: 0,
        unique_emails: 0,
        repeated_users: 0,
        emails: [],
      };
    } finally {
      setLoading(false);
    }
  }, [authToken, adminHeaders, onUnauthorized, setUserStatsIfChanged]);

  useEffect(() => {
    if (!authToken) return;
    fetchUserStats();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchUserStats, authToken]);

  return {
    userStats,
    loading,
    error,
    fetchUserStats,
  };
}
