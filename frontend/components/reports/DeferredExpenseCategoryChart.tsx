'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import type { ExpenseCategory } from './ExpenseCategoryChart';

type ChartComponent = ComponentType<{ data: ExpenseCategory[] }>;

export function DeferredExpenseCategoryChart({ data }: { data: ExpenseCategory[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [Chart, setChart] = useState<ChartComponent>();
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    const loadChart = () => {
      void import('./ExpenseCategoryChart')
        .then(({ ExpenseCategoryChart }) => {
          if (active) setChart(() => ExpenseCategoryChart);
        })
        .catch((error: unknown) => {
          console.error('Report chart failed to load.', error);
          if (active) setLoadError(true);
        });
    };

    if (!('IntersectionObserver' in window)) {
      loadChart();
      return () => {
        active = false;
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        loadChart();
      },
      { rootMargin: '200px' },
    );
    observer.observe(container);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-label="نمودار هزینه دسته‌ها"
      className="mt-6 h-72 w-full"
      ref={containerRef}
    >
      {Chart ? (
        <Chart data={data} />
      ) : loadError ? (
        <p className="app-muted p-4" role="alert">
          بارگذاری نمودار ممکن نشد؛ جزئیات هزینه‌ها در فهرست زیر در دسترس است.
        </p>
      ) : (
        <span className="sr-only" role="status">در حال بارگذاری نمودار…</span>
      )}
    </div>
  );
}
