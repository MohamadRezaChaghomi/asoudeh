import { fa } from '@/lib/messages/fa';
import { formatTomanAmount } from '@/lib/tomanAmount';

interface TomanAmountProps {
  amount: number | string;
  className?: string;
  unitClassName?: string;
}

export function TomanAmount({ amount, className, unitClassName }: TomanAmountProps) {
  return (
    <>
      <bdi className={className} dir="ltr">
        {formatTomanAmount(amount)}
      </bdi>{' '}
      <span className={unitClassName}>{fa.glossary.toman}</span>
    </>
  );
}
