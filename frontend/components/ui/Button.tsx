import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, ...props }: Props) {
  return (
    <button
      className={cn(
        'min-h-12 rounded-xl bg-asoudeh-navy px-5 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
