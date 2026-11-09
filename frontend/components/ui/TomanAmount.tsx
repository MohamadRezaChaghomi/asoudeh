import { fa } from '@/lib/messages/fa';
import { cn } from '@/lib/utils/cn';
import { formatTomanAmount } from '@/lib/tomanAmount';

interface TomanAmountProps {
  amount: number | string;
  className?: string;
  unitClassName?: string;
}

export function TomanAmount({ amount, className, unitClassName }: TomanAmountProps) {
  return (
    <>
      <bdi className={cn('financial-amount', className)} dir="ltr">
        {formatTomanAmount(amount)}
      </bdi>{' '}
      <span className={unitClassName}>{fa.glossary.toman}</span>
    </>
  );
}
