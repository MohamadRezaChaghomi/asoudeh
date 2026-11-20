import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const installedModules = join(frontendRoot, 'node_modules');
const generatedRootNames = new Set([
  '.next',
  '.next-dev',
  '.next-playwright',
  '.next-shell-test',
  'coverage',
  'dist',
  'playwright-report',
  'blob-report',
  'test-results',
]);
const environmentNames = new Set([
  'PATH',
  'SystemRoot',
  'WINDIR',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
]);

function shouldCopy(source) {
  const relativePath = relative(frontendRoot, source);
  if (!relativePath) return true;

  const segments = relativePath.split(sep);
  const rootName = segments[0];
  const fileName = basename(source);
  return !(
    (segments.length === 1 && generatedRootNames.has(rootName)) ||
    segments.some((segment) =>
      segment === 'node_modules' ||
      segment === '.git' ||
      segment === '.env' ||
      segment.startsWith('.env.'),
    ) ||
    fileName.endsWith('.tsbuildinfo')
  );
}

function createIsolatedEnvironment() {
  const environment = Object.fromEntries(
    [...environmentNames]
      .filter((name) => process.env[name])
      .map((name) => [name, process.env[name]]),
  );

  return {
    ...environment,
    NODE_ENV: 'test',
    NEXT_BUILD_DIR: '.next-dev',
    CI: 'true',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

function runNodeScript(scriptPath, args, workingDirectory, environment) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: workingDirectory,
    env: environment,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.signal) {
    console.error(`[typegen] ${basename(scriptPath)} stopped by signal ${result.signal}.`);
    return 1;
  }
  return result.status ?? 1;
}

async function main() {
  const generateOnly = process.argv.includes('--generate-only');
  const unsupportedArguments = process.argv.slice(2).filter((argument) => argument !== '--generate-only');
  if (unsupportedArguments.length > 0) {
    console.error(`[typegen] Unsupported argument(s): ${unsupportedArguments.join(', ')}`);
    return 2;
  }

  let temporaryRoot;
  try {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'asoudeh-next-typegen-'));
    const isolatedProject = join(temporaryRoot, 'frontend');
    await cp(frontendRoot, isolatedProject, {
      recursive: true,
      filter: shouldCopy,
    });
    await symlink(
      installedModules,
      join(isolatedProject, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const environment = createIsolatedEnvironment();
    const nextCli = join(isolatedProject, 'node_modules', 'next', 'dist', 'bin', 'next');
    console.log('[typegen] Generating route types in an isolated temporary project.');
    const typegenStatus = runNodeScript(nextCli, ['typegen'], isolatedProject, environment);
    if (typegenStatus !== 0 || generateOnly) return typegenStatus;

    const typeScriptCli = join(isolatedProject, 'node_modules', 'typescript', 'bin', 'tsc');
    console.log('[typegen] Running the frontend TypeScript check against those generated types.');
    return runNodeScript(
      typeScriptCli,
      ['--noEmit', '-p', 'tsconfig.json'],
      isolatedProject,
      environment,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown type-generation error.';
    console.error(`[typegen] ${message}`);
    return 1;
  } finally {
    if (temporaryRoot) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

process.exitCode = await main();
