import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(
  process.env.ASOUDEH_FRONTEND_DIR || path.join(__dirname, '..'),
);
const publicRoot = path.join(frontendRoot, 'public');
const iconDir = path.join(publicRoot, 'icons');
const previewDir = path.join(publicRoot, 'preview');

function writeNewFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const descriptor = fs.openSync(filePath, 'wx');
  try {
    fs.writeFileSync(descriptor, data);
  } finally {
    fs.closeSync(descriptor);
  }
}

function makeIco(frames) {
  const headerSize = 6 + frames.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  let offset = headerSize;
  frames.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...frames.map(({ png }) => png)]);
}

async function renderOpenGraph(svgPath, outputPath) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const fontPath = path.join(
    frontendRoot,
    'node_modules',
    '@fontsource-variable',
    'estedad',
    'files',
    'estedad-arabic-wght-normal.woff2',
  );
  const fontData = fs.readFileSync(fontPath).toString('base64');
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><html lang="fa" dir="rtl"><head><style>
        @font-face {
          font-family: Estedad;
          src: url(data:font/woff2;base64,${fontData}) format("woff2");
          font-weight: 100 900;
        }
        html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
        svg { display: block; width: 1200px; height: 630px; }
      </style></head><body>${svg}</body></html>`,
      { waitUntil: 'load' },
    );
    const fontLoaded = await page.evaluate(async () => {
      const faces = await document.fonts.load('700 76px Estedad', 'آسوده');
      return faces.length > 0;
    });
    if (!fontLoaded) {
      throw new Error('Estedad did not load for the Open Graph export.');
    }

    const png = await page.screenshot({ type: 'png' });
    writeNewFile(outputPath, png);
  } finally {
    await browser.close();
  }
}

async function generateAssets() {
  const symbolSvg = path.join(publicRoot, 'logo', 'asoudeh-symbol.svg');
  const appIconSvg = path.join(iconDir, 'app-icon.svg');
  const maskableSvg = path.join(iconDir, 'icon-maskable.svg');
  const ogSvg = path.join(previewDir, 'og-image.svg');

  const faviconFrames = [];
  for (const size of [16, 32, 48, 64, 128, 256]) {
    const png = await sharp(symbolSvg).resize(size, size).png().toBuffer();
    faviconFrames.push({ size, png });
    if (size <= 128) {
      writeNewFile(path.join(iconDir, `favicon-${size}x${size}.png`), png);
    }
  }
  writeNewFile(path.join(iconDir, 'favicon.ico'), makeIco(faviconFrames));

  const rasterExports = [
    { source: appIconSvg, size: 180, output: 'apple-touch-icon.png' },
    { source: appIconSvg, size: 192, output: 'icon-192.png' },
    { source: appIconSvg, size: 512, output: 'icon-512.png' },
    { source: maskableSvg, size: 512, output: 'icon-maskable-512.png' },
    { source: appIconSvg, size: 1024, output: 'icon-1024.png' },
  ];

  for (const { source, size, output } of rasterExports) {
    const png = await sharp(source).resize(size, size).png().toBuffer();
    writeNewFile(path.join(iconDir, output), png);
  }

  await renderOpenGraph(ogSvg, path.join(previewDir, 'og-image.png'));
}

generateAssets().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
