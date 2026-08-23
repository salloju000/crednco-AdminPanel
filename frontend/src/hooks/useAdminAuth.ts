import { useState, useEffect, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

/**
 * Owns the admin JWT: initial read from sessionStorage, keeping sessionStorage
 * in sync as it changes, logout, and a 20-minute inactivity auto-logout.
 *
 * Extracted from App.tsx, which previously owned this alongside unrelated
 * theme/tab/accounts-filter state.
 */
export function useAdminAuth() {
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem('admin_token'));

  const handleLogOut = useCallback(() => {
    setAuthToken(null);
  }, []);

  // Sync token to sessionStorage
  useEffect(() => {
    if (authToken) {
      sessionStorage.setItem('admin_token', authToken);
    } else {
      sessionStorage.removeItem('admin_token');
    }
  }, [authToken]);

  // Inactivity Logout (20 minutes)
  useEffect(() => {
    if (!authToken) return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogOut();
      }, INACTIVITY_TIMEOUT_MS);
    };

    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, resetTimer));
      clearTimeout(timeoutId);
    };
  }, [authToken, handleLogOut]);

  return { authToken, setAuthToken, handleLogOut };
}
