import { useState, useEffect } from 'react';

/**
 * Owns the dark/light theme flag: initial detection from localStorage or the
 * OS preference, and keeping the <html> class + localStorage in sync as it
 * changes.
 *
 * Extracted from App.tsx, which previously owned this alongside unrelated
 * auth/tab/accounts-filter state.
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return { isDark, setIsDark };
}
