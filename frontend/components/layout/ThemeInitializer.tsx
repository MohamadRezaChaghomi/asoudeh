'use client';

import { useEffect } from 'react';

export function ThemeInitializer() {
  useEffect(() => {
    document.documentElement.dataset.theme =
      window.localStorage.getItem('asoudeh.theme') === 'dark' ? 'dark' : 'light';
  }, []);

  return null;
}
