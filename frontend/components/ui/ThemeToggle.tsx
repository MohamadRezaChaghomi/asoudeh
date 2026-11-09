'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

const storageKey = 'asoudeh.theme';
const themeChangeEvent = 'asoudeh-theme-change';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => {
      const savedTheme = window.localStorage.getItem(storageKey);
      const nextTheme =
        savedTheme === 'light' || savedTheme === 'dark'
          ? savedTheme
          : mediaQuery.matches
            ? 'dark'
            : 'light';
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };
    const syncSystemTheme = () => {
      if (window.localStorage.getItem(storageKey) !== null) return;
      syncTheme();
    };
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      syncTheme();
    };

    syncTheme();
    setReady(true);
    mediaQuery.addEventListener('change', syncSystemTheme);
    window.addEventListener('storage', syncStoredTheme);
    return () => {
      mediaQuery.removeEventListener('change', syncSystemTheme);
      window.removeEventListener('storage', syncStoredTheme);
    };
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(storageKey, nextTheme);
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      aria-label={theme === 'dark' ? 'فعال‌کردن پوسته روشن' : 'فعال‌کردن پوسته تیره'}
      aria-pressed={theme === 'dark'}
      className={`theme-toggle${compact ? ' theme-toggle--compact' : ''}`}
      disabled={!ready}
      onClick={toggleTheme}
      type="button"
    >
      {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
      <span>{theme === 'dark' ? 'پوسته روشن' : 'پوسته تیره'}</span>
    </button>
  );
}
