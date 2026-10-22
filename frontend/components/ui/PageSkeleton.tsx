import { cn } from '@/lib/utils/cn';

type PageSkeletonVariant =
  | 'dashboard'
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'reports'
  | 'reminders'
  | 'caregiver'
  | 'settings';

interface PageSkeletonProps {
  label: string;
  variant: PageSkeletonVariant;
  showHeader?: boolean;
}

interface SkeletonLayout {
  summaryCards: number;
  cards: number;
  rows: number;
  columns: 1 | 2;
  chart: boolean;
  filters: boolean;
  form: boolean;
}

const layouts: Record<PageSkeletonVariant, SkeletonLayout> = {
  dashboard: { summaryCards: 3, cards: 0, rows: 3, columns: 1, chart: true, filters: false, form: false },
  transactions: { summaryCards: 0, cards: 0, rows: 5, columns: 1, chart: false, filters: true, form: false },
  categories: { summaryCards: 0, cards: 4, rows: 0, columns: 2, chart: false, filters: false, form: false },
  budgets: { summaryCards: 0, cards: 4, rows: 0, columns: 2, chart: false, filters: false, form: false },
  reports: { summaryCards: 3, cards: 0, rows: 0, columns: 1, chart: true, filters: true, form: false },
  reminders: { summaryCards: 0, cards: 0, rows: 3, columns: 1, chart: false, filters: false, form: true },
  caregiver: { summaryCards: 0, cards: 0, rows: 2, columns: 1, chart: false, filters: false, form: true },
  settings: { summaryCards: 0, cards: 0, rows: 3, columns: 1, chart: false, filters: false, form: false },
};

function SkeletonBlock({ className }: { className: string }) {
  return <span className={cn('skeleton-block', className)} />;
}

export function PageSkeleton({
  label,
  variant,
  showHeader = true,
}: PageSkeletonProps) {
  const layout = layouts[variant];

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5" aria-busy="true">
      <p className="sr-only" role="status">{label}</p>
      {showHeader && (
        <div className="flex items-center justify-between gap-4" aria-hidden="true">
          <div className="space-y-2">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="h-8 w-48" />
          </div>
          <SkeletonBlock className="h-11 w-32 rounded-xl" />
        </div>
      )}

      {layout.summaryCards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: layout.summaryCards }, (_, index) => (
            <div className="app-panel space-y-4 rounded-2xl border border-slate-200 p-5" key={index}>
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-8 w-36" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          ))}
        </div>
      )}

      {layout.filters && (
        <div className="app-panel flex flex-wrap gap-3 rounded-2xl border border-slate-200 p-5" aria-hidden="true">
          <SkeletonBlock className="h-11 min-w-44 flex-1 rounded-xl" />
          <SkeletonBlock className="h-11 w-32 rounded-xl" />
          <SkeletonBlock className="h-11 w-32 rounded-xl" />
        </div>
      )}

      {layout.form && (
        <div className="app-panel grid gap-4 rounded-2xl border border-slate-200 p-5 sm:grid-cols-2" aria-hidden="true">
          <SkeletonBlock className="h-11 rounded-xl" />
          <SkeletonBlock className="h-11 rounded-xl" />
          <SkeletonBlock className="h-11 rounded-xl sm:col-span-2" />
        </div>
      )}

      {layout.chart && (
        <div className="app-panel space-y-5 rounded-2xl border border-slate-200 p-5" aria-hidden="true">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-56 w-full rounded-xl" />
        </div>
      )}

      {layout.cards > 0 && (
        <div
          className={cn(
            'grid gap-4',
            layout.columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
          )}
          aria-hidden="true"
        >
          {Array.from({ length: layout.cards }, (_, index) => (
            <div className="app-panel space-y-4 rounded-2xl border border-slate-200 p-5" key={index}>
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock className="h-6 w-32" />
                <SkeletonBlock className="h-8 w-8 rounded-full" />
              </div>
              <SkeletonBlock className="h-3 w-4/5" />
              <SkeletonBlock className="h-3 w-2/3" />
              <SkeletonBlock className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      )}

      {layout.rows > 0 && (
        <div className="app-panel skeleton-list divide-y rounded-2xl border border-slate-200 px-5" aria-hidden="true">
          {Array.from({ length: layout.rows }, (_, index) => (
            <div className="flex items-center gap-4 py-4" key={index}>
              <SkeletonBlock className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-2/5" />
                <SkeletonBlock className="h-3 w-1/4" />
              </div>
              <SkeletonBlock className="h-5 w-20" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
