import { expect, type Page } from '@playwright/test';

export async function expectThemeAwareIllustration(page: Page, testId: string): Promise<void> {
  const contrastRatios = await page.evaluate((illustrationTestId) => {
    const illustration = document.querySelector<HTMLElement>(
      `[data-testid="${illustrationTestId}"]`,
    );
    const icon = illustration?.querySelector('svg');
    if (!illustration || !icon) throw new Error(`Missing illustration: ${illustrationTestId}`);

    const originalTheme = document.documentElement.dataset.theme;
    const originalHighContrast = document.documentElement.dataset.highContrast;
    const measure = (theme: string, highContrast: boolean) => {
      document.documentElement.dataset.theme = theme;
      if (highContrast) document.documentElement.dataset.highContrast = 'true';
      else delete document.documentElement.dataset.highContrast;
      const foreground = getComputedStyle(icon).color.match(/\d+/g)?.map(Number);
      const background = getComputedStyle(illustration).backgroundColor.match(/\d+/g)?.map(Number);
      if (!foreground || !background) throw new Error('Illustration colors could not be measured.');
      const luminance = ([red, green, blue]: number[]) => {
        const channels = [red, green, blue].map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const first = luminance(foreground);
      const second = luminance(background);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };

    const ratios = [measure('light', false), measure('dark', false), measure('light', true)];
    if (originalTheme) document.documentElement.dataset.theme = originalTheme;
    else delete document.documentElement.dataset.theme;
    if (originalHighContrast) {
      document.documentElement.dataset.highContrast = originalHighContrast;
    } else {
      delete document.documentElement.dataset.highContrast;
    }
    return ratios;
  }, testId);

  expect(contrastRatios.every((ratio) => ratio >= 3)).toBe(true);
}
