import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

type BrandLogoVariant = 'symbol' | 'white';
type BrandLogoSize = 'sidebar' | 'mobile' | 'auth' | 'auth-symbol' | 'landing' | 'footer';

const logoAssets: Record<BrandLogoVariant, { src: string; width: number; height: number }> = {
  symbol: { src: '/logo/asoudeh-symbol.svg', width: 512, height: 512 },
  white: { src: '/logo/asoudeh-white.svg', width: 512, height: 512 },
};

const logoSizes: Record<BrandLogoSize, string> = {
  sidebar: '160px',
  mobile: '48px',
  auth: '128px',
  'auth-symbol': '64px',
  landing: '(max-width: 760px) 45vw, 128px',
  footer: '144px',
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  alt?: string;
  showWordmark?: boolean;
  priority?: boolean;
  className?: string;
}

export function BrandLogo({
  size = 'auth',
  alt = 'نشان آسوده',
  showWordmark = false,
  priority = false,
  className,
}: BrandLogoProps) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={cn(
        'brand-logo-frame',
        `brand-logo-frame--${size}`,
        className,
      )}
    >
      <span aria-hidden="true" className="brand-logo-mark">
        {(Object.keys(logoAssets) as BrandLogoVariant[]).map((logoVariant) => {
          const asset = logoAssets[logoVariant];
          return (
            <Image
              alt=""
              className={`brand-logo-image brand-logo-image--${logoVariant}`}
              height={asset.height}
              key={logoVariant}
              priority={priority}
              sizes={logoSizes[size]}
              src={asset.src}
              width={asset.width}
            />
          );
        })}
      </span>
      {showWordmark && (
        <span aria-hidden="true" className="brand-logo-wordmark">
          آسوده
        </span>
      )}
    </span>
  );
}
