import { TomanAmount } from '@/components/ui/TomanAmount';

export interface ExpenseCategory {
  categoryId: string;
  categoryName: string;
  amount: string | number;
  sharePercentage: number;
}

const percentageFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

export function ExpenseCategoryChart({ data }: { data: ExpenseCategory[] }) {
  return (
    <ul aria-label="هزینه به تفکیک دسته" className="grid gap-3">
      {data.map(({ categoryId, categoryName, amount, sharePercentage }, index) => {
        const share = Math.min(100, Math.max(0, sharePercentage));
        const formattedShare = percentageFormatter.format(share);

        return (
          <li
            className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 sm:p-5"
            key={categoryId}
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-100)] text-sm font-bold text-[var(--brand-900)]"
                >
                  {new Intl.NumberFormat('fa-IR').format(index + 1)}
                </span>
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-bold">{categoryName}</h3>
                  <p className="app-muted mt-1 text-sm">هزینه ثبت‌شده در این دسته</p>
                </div>
              </div>
              <div className="flex items-end justify-between gap-5 sm:justify-end">
                <div className="min-w-0">
                  <p className="app-muted text-xs font-semibold">مبلغ</p>
                  <p className="mt-1 break-words text-lg font-bold">
                    <TomanAmount
                      amount={amount}
                      className="whitespace-nowrap tabular-nums"
                      unitClassName="whitespace-nowrap text-xs"
                    />
                  </p>
                </div>
                <div className="min-w-24 rounded-xl bg-[var(--brand-50)] px-3 py-2 text-center text-[var(--brand-900)]">
                  <p className="app-muted text-xs font-semibold">سهم از کل</p>
                  <p className="mt-1 text-lg font-extrabold">{formattedShare}٪</p>
                </div>
              </div>
            </div>
            <div
              aria-label={`سهم هزینهٔ ${categoryName}`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={share}
              aria-valuetext={`${formattedShare} درصد`}
              className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--surface)]"
              role="progressbar"
            >
              <div
                className="expense-category-chart-bar h-full rounded-full bg-[var(--brand-action)]"
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
