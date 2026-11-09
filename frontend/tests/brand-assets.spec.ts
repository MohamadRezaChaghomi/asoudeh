import { expect, test } from './diagnostics-test';

const brandAssets = [
  '/logo/asoudeh-primary.svg',
  '/logo/asoudeh-horizontal.svg',
  '/logo/asoudeh-symbol.svg',
  '/logo/asoudeh-white.svg',
  '/logo/asoudeh-monochrome.svg',
  '/icons/app-icon.svg',
  '/icons/icon-maskable.svg',
  '/illustrations/empty-budgets.svg',
  '/illustrations/empty-reminders.svg',
  '/illustrations/empty-transactions.svg',
  '/icons/favicon.ico',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-48x48.png',
  '/icons/favicon-64x64.png',
  '/icons/favicon-128x128.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/icon-1024.png',
  '/preview/og-image.svg',
  '/preview/og-image.png',
  '/og-image.svg',
  '/offline.html',
  '/sw.js',
];

test('all referenced brand assets exist and manifest dimensions match their files', async ({
  page,
}) => {
  for (const asset of brandAssets) {
    const response = await page.request.get(asset);
    expect(response.ok(), `${asset} should be available`).toBe(true);
  }

  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    icons: Array<{ src: string; sizes: string; type: string }>;
  };
  await page.goto('/');

  const manifestImages = await page.evaluate(
    async (icons) =>
      Promise.all(
        icons.map(
          (icon) =>
            new Promise<{ src: string; width: number; height: number }>((resolve, reject) => {
              const image = new Image();
              image.onload = () =>
                resolve({
                  src: icon.src,
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                });
              image.onerror = () => reject(new Error(`Unable to decode ${icon.src}`));
              image.src = icon.src;
            }),
        ),
      ),
    manifest.icons,
  );

  for (const icon of manifest.icons) {
    const expectedSize = Number(icon.sizes.split('x')[0]);
    const image = manifestImages.find(({ src }) => src === icon.src);
    expect(icon.type).toBe('image/png');
    expect(image).toEqual({ src: icon.src, width: expectedSize, height: expectedSize });
  }

  const ogImageUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(ogImageUrl).not.toBeNull();
  expect(new URL(ogImageUrl as string, page.url()).pathname).toBe('/preview/og-image.png');
});

test('logo component dimensions match the supplied SVG viewBoxes', async ({ page }) => {
  const logos = [
    { path: '/logo/asoudeh-primary.svg', width: 600, height: 780 },
    { path: '/logo/asoudeh-horizontal.svg', width: 440, height: 110 },
    { path: '/logo/asoudeh-symbol.svg', width: 512, height: 512 },
    { path: '/logo/asoudeh-white.svg', width: 512, height: 512 },
    { path: '/logo/asoudeh-monochrome.svg', width: 512, height: 512 },
  ];

  for (const logo of logos) {
    const response = await page.request.get(logo.path);
    const svg = await response.text();
    const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(viewBox, logo.path).not.toBeNull();
    expect(Number(viewBox?.[1]), logo.path).toBe(logo.width);
    expect(Number(viewBox?.[2]), logo.path).toBe(logo.height);
  }

  await page.goto('/login');
  await expect(page.locator('img[src="/logo/asoudeh-primary.svg"]')).toHaveAttribute(
    'width',
    '600',
  );
  await expect(page.locator('img[src="/logo/asoudeh-primary.svg"]')).toHaveAttribute(
    'height',
    '780',
  );
  await page.goto('/');
  const horizontalLogo = page
    .getByRole('banner')
    .locator('img[src="/logo/asoudeh-horizontal.svg"]');
  await expect(horizontalLogo).toHaveAttribute(
    'width',
    '440',
  );
  await expect(horizontalLogo).toHaveAttribute(
    'height',
    '110',
  );
});

test('ICO contains all required square frames', async ({ page }) => {
  const response = await page.request.get('/icons/favicon.ico');
  const ico = Buffer.from(await response.body());
  expect(ico.readUInt16LE(0)).toBe(0);
  expect(ico.readUInt16LE(2)).toBe(1);

  const frameCount = ico.readUInt16LE(4);
  const sizes = Array.from({ length: frameCount }, (_, index) => {
    const width = ico.readUInt8(6 + index * 16);
    return width || 256;
  });
  expect(sizes).toEqual([16, 32, 48, 64, 128, 256]);
});

test('brand tokens meet text and UI contrast thresholds across themes', async ({ page }) => {
  await page.goto('/');
  const ratios = await page.evaluate(() => {
    const contrast = (foreground: string, background: string) => {
      const luminance = (color: string) => {
        const [red, green, blue] = color.match(/\d+/g)!.map(Number).map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return red * 0.2126 + green * 0.7152 + blue * 0.0722;
      };
      const first = luminance(foreground);
      const second = luminance(background);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };
    const color = (name: string) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${name})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    const measure = (theme: 'light' | 'dark', highContrast: boolean) => {
      document.documentElement.dataset.theme = theme;
      if (highContrast) {
        document.documentElement.dataset.highContrast = 'true';
      } else {
        delete document.documentElement.dataset.highContrast;
      }

      const surface = color('--surface');
      return {
        mainText: contrast(color('--text'), surface),
        mutedText: contrast(color('--text-muted'), surface),
        subtleText: contrast(color('--text-subtle'), surface),
        secondaryBrandText: contrast(color('--color-brand-secondary-text'), surface),
        actionSurface: contrast(color('--brand-action'), surface),
        actionText: contrast(color('--text-on-action'), color('--brand-action')),
        focus: contrast(color('--focus'), surface),
        border: contrast(color('--border'), surface),
        income: contrast(color('--color-income'), surface),
        expense: contrast(color('--color-expense'), surface),
      };
    };

    return {
      light: measure('light', false),
      dark: measure('dark', false),
      highContrast: measure('light', true),
    };
  });

  for (const theme of Object.values(ratios)) {
    expect(theme.mainText).toBeGreaterThanOrEqual(4.5);
    expect(theme.mutedText).toBeGreaterThanOrEqual(4.5);
    expect(theme.subtleText).toBeGreaterThanOrEqual(4.5);
    expect(theme.secondaryBrandText).toBeGreaterThanOrEqual(4.5);
    expect(theme.actionSurface).toBeGreaterThanOrEqual(3);
    expect(theme.actionText).toBeGreaterThanOrEqual(4.5);
    expect(theme.focus).toBeGreaterThanOrEqual(3);
    expect(theme.border).toBeGreaterThanOrEqual(3);
    expect(theme.income).toBeGreaterThanOrEqual(4.5);
    expect(theme.expense).toBeGreaterThanOrEqual(4.5);
  }
});
