'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { api } from '@/lib/api/client';

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

  useEffect(() => {
    setError('');
    if (pathname === '/settings') return;
    let active = true;

    async function loadAccessibilityPreferences() {
      try {
        const response = await api.get<{
          success: true;
          data: { profile: AccessibilityProfile };
        }>('/me');
        if (!active) return;
        const settings = response.data.data.profile.accessibilitySettings;
        document.documentElement.style.setProperty(
          '--font-scale',
          `${settings.fontScale * 100}%`,
        );
        document.documentElement.dataset.highContrast = String(settings.highContrast);
      } catch (loadError) {
        if (!active) return;
        if (axios.isAxiosError(loadError) && loadError.response?.status === 401) {
          router.replace('/login');
          return;
        }
        setError(profileErrorMessage(loadError));
      }
    }

    void loadAccessibilityPreferences();
    return () => {
      active = false;
      document.documentElement.style.removeProperty('--font-scale');
      delete document.documentElement.dataset.highContrast;
    };
  }, [pathname, router]);

  return (
    <>
      {error && (
        <p className="mx-auto max-w-6xl px-5 pt-4 text-red-800" role="alert">
          {error}
        </p>
      )}
      {children}
    </>
  );
}
