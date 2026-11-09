import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

export type BrandLogoVariant = 'primary' | 'horizontal' | 'symbol' | 'white' | 'monochrome';
type BrandLogoSize = 'sidebar' | 'mobile' | 'auth' | 'landing' | 'footer';

const logoAssets: Record<BrandLogoVariant, { src: string; width: number; height: number }> = {
  primary: { src: '/logo/asoudeh-primary.svg', width: 160, height: 170 },
  horizontal: { src: '/logo/asoudeh-horizontal.svg', width: 170, height: 160 },
  symbol: { src: '/logo/asoudeh-symbol.svg', width: 200, height: 200 },
  white: { src: '/logo/asoudeh-white.svg', width: 190, height: 190 },
  monochrome: { src: '/logo/asoudeh-monochrome.svg', width: 190, height: 190 },
};

const logoSizes: Record<BrandLogoSize, string> = {
  sidebar: '160px',
  mobile: '48px',
  auth: '192px',
  landing: '(max-width: 760px) 45vw, 160px',
  footer: '144px',
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  variant?: BrandLogoVariant;
  alt?: string;
  priority?: boolean;
  className?: string;
}

export function BrandLogo({
  size = 'auth',
  variant = 'horizontal',
  alt = 'نشان آسوده',
  priority = false,
  className,
}: BrandLogoProps) {
  const asset = logoAssets[variant];

  return (
    <span
      className={cn(
        'brand-logo-frame',
        `brand-logo-frame--${size}`,
        `brand-logo-frame--${variant}`,
        className,
      )}
    >
      <Image
        alt={alt}
        className="brand-logo-image"
        height={asset.height}
        priority={priority}
        sizes={logoSizes[size]}
        src={asset.src}
        width={asset.width}
      />
      {variant !== 'symbol' && (
        <span aria-hidden="true" className="brand-logo-wordmark">
          آسوده
        </span>
      )}
    </span>
  );
}
