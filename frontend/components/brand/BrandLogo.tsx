import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

type BrandLogoSize = 'sidebar' | 'auth' | 'landing';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
}

export function BrandLogo({ size = 'auth', className }: BrandLogoProps) {
  return (
    <span className={cn('brand-logo-frame', `brand-logo-frame--${size}`, className)}>
      <Image
        alt="لوگوی آسوده"
        className="brand-logo-image"
        height={400}
        priority
        src="/icons/logo.svg"
        width={600}
      />
    </span>
  );
}
