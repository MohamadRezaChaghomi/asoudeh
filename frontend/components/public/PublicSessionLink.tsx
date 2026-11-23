'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getPublicReturnPath,
  hasSessionHint,
  sessionHintEvent,
} from '@/lib/auth/sessionHint';

export function PublicSessionLink({ className }: { className?: string }) {
  const [sessionActive, setSessionActive] = useState(false);
  const [returnPath, setReturnPath] = useState('/dashboard');

  useEffect(() => {
    const syncSession = () => {
      const active = hasSessionHint();
      setSessionActive(active);
      if (active) setReturnPath(getPublicReturnPath());
    };

    syncSession();
    window.addEventListener(sessionHintEvent, syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener(sessionHintEvent, syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  return (
    <Link className={className} href={sessionActive ? returnPath : '/login'}>
      {sessionActive ? 'بازگشت به صفحهٔ قبلی' : 'ورود به آسوده'}
    </Link>
  );
}
