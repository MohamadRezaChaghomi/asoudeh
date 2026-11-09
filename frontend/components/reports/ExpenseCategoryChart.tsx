'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TomanAmount } from '@/components/ui/TomanAmount';
import { fa } from '@/lib/messages/fa';

export interface ExpenseCategory {
  categoryId: string;
  categoryName: string;
  amount: string;
}

export function ExpenseCategoryChart({ data }: { data: ExpenseCategory[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          stroke="var(--text-muted)"
          tickFormatter={(value: number) => new Intl.NumberFormat('fa-IR').format(value)}
          type="number"
        />
        <YAxis dataKey="categoryName" stroke="var(--text-muted)" type="category" width={110} />
        <Tooltip
          formatter={(value) => [
            <TomanAmount amount={String(value)} key="amount" />,
            fa.glossary.expense,
          ]}
          labelFormatter={(label) => String(label)}
        />
        <Bar dataKey="amount" fill="var(--brand-secondary-action)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
