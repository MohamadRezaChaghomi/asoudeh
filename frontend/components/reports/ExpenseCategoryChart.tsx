export interface ExpenseCategory {
  categoryId: string;
  categoryName: string;
  sharePercentage: number;
}

export function ExpenseCategoryChart({ data }: { data: ExpenseCategory[] }) {
  return (
    <div aria-label="هزینه به تفکیک دسته" className="mt-6 grid gap-3" role="img">
      {data.map(({ categoryId, categoryName, sharePercentage }) => (
        <div
          className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3"
          key={categoryId}
        >
          <span className="truncate text-sm">{categoryName}</span>
          <div className="h-5 overflow-hidden rounded bg-[var(--surface-muted)]">
            <div
              className="expense-category-chart-bar h-full rounded bg-[var(--brand-secondary-action)]"
              style={{ width: `${Math.min(100, Math.max(0, sharePercentage))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
