'use client';

import { useEffect, useRef, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function ServiceWorkerRegistration() {
  const [connectivityNotice, setConnectivityNotice] = useState<'offline' | 'restored' | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [iosHintDismissed, setIosHintDismissed] = useState(false);
  const [installError, setInstallError] = useState('');
  const [updating, setUpdating] = useState(false);
  const reloadAfterUpdate = useRef(false);

  useEffect(() => {
    let wasOffline = !navigator.onLine;
    let restoredTimer: number | undefined;
    if (wasOffline) setConnectivityNotice('offline');
    const showOffline = () => {
      wasOffline = true;
      window.clearTimeout(restoredTimer);
      setConnectivityNotice('offline');
    };
    const showRestored = () => {
      if (!wasOffline) return;
      wasOffline = false;
      setConnectivityNotice('restored');
      window.clearTimeout(restoredTimer);
      restoredTimer = window.setTimeout(() => setConnectivityNotice(null), 3000);
    };
    const updateStandaloneStatus = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(standalone);
    };

    updateStandaloneStatus();
    window.addEventListener('online', showRestored);
    window.addEventListener('offline', showOffline);
    const displayMode = window.matchMedia('(display-mode: standalone)');
    displayMode.addEventListener('change', updateStandaloneStatus);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    const userAgent = navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setShowIosHint(isIos);

    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('online', showRestored);
        window.removeEventListener('offline', showOffline);
        window.clearTimeout(restoredTimer);
        displayMode.removeEventListener('change', updateStandaloneStatus);
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      };
    }

    let active = true;
    let registration: ServiceWorkerRegistration | undefined;

    const showWaitingWorker = () => {
      if (registration?.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }
    };

    const onControllerChange = () => {
      if (reloadAfterUpdate.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js')
      .then((registered) => {
        if (!active) return;
        registration = registered;
        showWaitingWorker();
        registered.addEventListener('updatefound', () => {
          const installingWorker = registered.installing;
          installingWorker?.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') showWaitingWorker();
          });
        });
        void registered.update().catch((error: unknown) => {
          console.error('Service worker update check failed.', error);
        });
      })
      .catch((error: unknown) => {
        console.error('Service worker registration failed.', error);
      });

    return () => {
      active = false;
      window.removeEventListener('online', showRestored);
      window.removeEventListener('offline', showOffline);
      window.clearTimeout(restoredTimer);
      displayMode.removeEventListener('change', updateStandaloneStatus);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    setInstallError('');
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setInstallDismissed(true);
    } catch (error) {
      console.error('App installation prompt failed.', error);
      setInstallError('نصب برنامه انجام نشد؛ کمی بعد دوباره تلاش کنید.');
    }
  }

  function activateUpdate() {
    if (!waitingWorker) return;
    reloadAfterUpdate.current = true;
    setUpdating(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  return (
    <aside className="pwa-notices" aria-label="وضعیت برنامه">
      {connectivityNotice && (
        <p
          className={`pwa-connectivity is-${connectivityNotice}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" className="pwa-connectivity-dot" />
          {connectivityNotice === 'offline' ? 'اتصال اینترنت برقرار نیست' : 'اتصال برقرار شد'}
        </p>
      )}

      {waitingWorker && (
        <section className="pwa-notice" role="status" aria-live="polite">
          <p>نسخهٔ جدید آسوده آماده است.</p>
          <button className="pwa-notice-primary" disabled={updating} onClick={activateUpdate} type="button">
            {updating ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}
          </button>
          <button className="pwa-notice-dismiss" onClick={() => setWaitingWorker(null)} type="button">
            بعداً
          </button>
        </section>
      )}

      {!isStandalone && !installDismissed && installPrompt && (
        <section className="pwa-notice" role="status" aria-live="polite">
          <p>آسوده را برای دسترسی آسان‌تر نصب کنید.</p>
          {installError && <p role="alert">{installError}</p>}
          <button className="pwa-notice-primary" onClick={() => void installApp()} type="button">
            نصب برنامه
          </button>
          <button className="pwa-notice-dismiss" onClick={() => setInstallDismissed(true)} type="button">
            بستن
          </button>
        </section>
      )}

      {!isStandalone && !installDismissed && !installPrompt && showIosHint && !iosHintDismissed && (
        <section className="pwa-notice" role="status" aria-live="polite">
          <p>برای نصب، در منوی اشتراک‌گذاری گزینهٔ «افزودن به صفحهٔ اصلی» را بزنید.</p>
          <button className="pwa-notice-dismiss" onClick={() => setIosHintDismissed(true)} type="button">
            بستن
          </button>
        </section>
      )}
    </aside>
  );
}
