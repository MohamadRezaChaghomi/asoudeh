'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { api } from '@/lib/api/client';
import { AppShell } from '@/components/layout/AppShell';
import { SessionActivityMonitor } from '@/components/layout/SessionActivityMonitor';

interface AccessibilityProfile {
  accessibilitySettings: {
    fontScale: number;
    highContrast: boolean;
  };
}

function profileErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data.error?.message ?? 'تنظیمات دسترس‌پذیری بارگذاری نشد.';
  }
  return 'تنظیمات دسترس‌پذیری بارگذاری نشد.';
}

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState('');
  const accessibilityPreferencesRequested = useRef(false);

  useEffect(() => {
    if (pathname === '/settings' || accessibilityPreferencesRequested.current) return;
    accessibilityPreferencesRequested.current = true;
    setError('');

    async function loadAccessibilityPreferences() {
      try {
        const response = await api.get<{
          success: true;
          data: { profile: AccessibilityProfile };
        }>('/me');
        const settings = response.data.data.profile.accessibilitySettings;
        document.documentElement.style.setProperty(
          '--font-scale',
          `${settings.fontScale * 100}%`,
        );
        document.documentElement.dataset.highContrast = String(settings.highContrast);
      } catch (loadError) {
        accessibilityPreferencesRequested.current = false;
        if (axios.isAxiosError(loadError) && loadError.response?.status === 401) {
          router.replace('/login');
          return;
        }
        setError(profileErrorMessage(loadError));
      }
    }

    void loadAccessibilityPreferences();
  }, [pathname, router]);

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--font-scale');
      delete document.documentElement.dataset.highContrast;
    },
    [],
  );

  return (
    <AppShell>
      <SessionActivityMonitor />
      {error && (
        <p className="mx-auto max-w-6xl px-5 pt-4 text-red-800" role="alert">
          {error}
        </p>
      )}
      {children}
    </AppShell>
  );
}
