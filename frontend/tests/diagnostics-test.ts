import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test as base } from '@playwright/test';

const diagnosticsPath = resolve('test-results/browser-diagnostics.ndjson');

function recordDiagnostic(testTitle: string, type: string, message: string): void {
  mkdirSync(dirname(diagnosticsPath), { recursive: true });
  appendFileSync(
    diagnosticsPath,
    `${JSON.stringify({ test: testTitle, type, message })}\n`,
    'utf8',
  );
}

const test = base.extend<{ browserDiagnostics: void }>({
  browserDiagnostics: [
    async ({ page }, use, testInfo) => {
      const testTitle = testInfo.titlePath.join(' > ');
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          recordDiagnostic(testTitle, `console.${message.type()}`, message.text());
        }
      });
      page.on('pageerror', (error) => {
        recordDiagnostic(testTitle, 'pageerror', error.message);
      });
      page.on('requestfailed', (request) => {
        const url = new URL(request.url());
        recordDiagnostic(
          testTitle,
          'requestfailed',
          `${request.method()} ${url.origin}${url.pathname}: ${request.failure()?.errorText ?? 'unknown error'}`,
        );
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          const url = new URL(response.url());
          recordDiagnostic(
            testTitle,
            'http-error',
            `${response.status()} ${url.origin}${url.pathname}`,
          );
        }
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect, test };
