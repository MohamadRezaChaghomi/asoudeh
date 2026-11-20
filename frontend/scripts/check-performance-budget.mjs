import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const buildDir = process.env.NEXT_BUILD_DIR || '.next';
const chunksDir = path.join(buildDir, 'static', 'chunks');
const publicDir = 'public';
const maxJavaScriptBytes = 1_400_000;
const maxJavaScriptFileBytes = 300_000;
const maxImageBytes = 200_000;
const maxImageFileBytes = 100_000;
const imageExtensions = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
]);

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function totalSize(files) {
  const sizes = await Promise.all(
    files.map(async (file) => ({ file, bytes: (await stat(file)).size })),
  );
  return {
    bytes: sizes.reduce((total, item) => total + item.bytes, 0),
    largest: sizes.reduce((largest, item) => (
      item.bytes > largest.bytes ? item : largest
    ), { file: '', bytes: 0 }),
  };
}

const javascriptFiles = (await collectFiles(chunksDir))
  .filter((file) => file.endsWith('.js'));
const imageFiles = (await collectFiles(publicDir))
  .filter((file) => imageExtensions.has(path.extname(file).toLowerCase()));
const javascript = await totalSize(javascriptFiles);
const images = await totalSize(imageFiles);

console.log(`Client JavaScript: ${javascript.bytes} bytes (limit ${maxJavaScriptBytes})`);
console.log(`Largest JavaScript file: ${javascript.largest.bytes} bytes (limit ${maxJavaScriptFileBytes})`);
console.log(`Public images: ${images.bytes} bytes (limit ${maxImageBytes})`);
console.log(`Largest public image: ${images.largest.bytes} bytes (limit ${maxImageFileBytes})`);

if (
  javascript.bytes > maxJavaScriptBytes ||
  javascript.largest.bytes > maxJavaScriptFileBytes ||
  images.bytes > maxImageBytes ||
  images.largest.bytes > maxImageFileBytes
) {
  console.error('Performance asset budget exceeded.');
  process.exitCode = 1;
}
