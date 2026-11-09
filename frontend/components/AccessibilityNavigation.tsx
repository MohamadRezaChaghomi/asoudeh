'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function AccessibilityNavigation() {
  const pathname = usePathname();

  useEffect(() => {
    const previousPath = window.sessionStorage.getItem('asoudeh.accessibility.previousPathname');
    window.sessionStorage.setItem('asoudeh.accessibility.previousPathname', pathname);
    if (!previousPath || previousPath === pathname) return;

    let focusedMain = document.querySelectorAll<HTMLElement>('#main-content').item(0);
    if (!focusedMain) return;
    focusedMain.tabIndex = -1;
    focusedMain.focus({ preventScroll: true });

    const observer = new MutationObserver(() => {
      const mains = document.querySelectorAll<HTMLElement>('#main-content');
      const currentMain = mains.item(mains.length - 1);
      if (!currentMain) return;

      if (currentMain !== focusedMain) {
        const activeElement = document.activeElement;
        if (
          activeElement !== document.body &&
          activeElement !== focusedMain &&
          !focusedMain.contains(activeElement)
        ) {
          observer.disconnect();
          return;
        }
        focusedMain = currentMain;
        focusedMain.tabIndex = -1;
        focusedMain.focus({ preventScroll: true });
      }

      if (mains.length === 1 && !currentMain.querySelector('[aria-busy="true"]')) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <a
      className="global-skip-link"
      href="#main-content"
      onClick={(event) => {
        const main = document.getElementById('main-content');
        if (!main) return;
        event.preventDefault();
        main.tabIndex = -1;
        main.focus();
        main.scrollIntoView({ block: 'start' });
      }}
    >
      رفتن به محتوای اصلی
    </a>
  );
}
