import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

type BrandLogoSize = 'sidebar' | 'mobile' | 'auth' | 'landing';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
}

export function BrandLogo({ size = 'auth', className }: BrandLogoProps) {
  return (
    <span className={cn('brand-logo-frame', `brand-logo-frame--${size}`, className)}>
      <Image
        alt="نشان آسوده"
        className="brand-logo-image"
        height={600}
        priority
        sizes="(max-width: 700px) 144px, 176px"
        src="/icons/logoo.svg"
        width={600}
      />
    </span>
  );
}
