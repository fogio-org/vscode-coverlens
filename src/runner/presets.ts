import * as fs from 'fs';
import * as path from 'path';

export interface ScopedRun {
  /** Argv (first element is the executable, rest are args). Pass with shell:true for cross-platform binary resolution. */
  argv: string[];
}

export interface RunnerPreset {
  name: string;
  /** Argv for running ALL tests and outputting a coverage file */
  argv: string[];
  /** Builder for argv scoped to a specific directory (relative to workspace root) */
  scoped?: (relativeDir: string) => ScopedRun;
  /** If scoped run writes to a separate file, specify it here for merging */
  scopedOutput?: string;
  /** Expected coverage output glob (relative to workspace root) */
  outputGlob: string;
}

export const PRESETS: Record<string, RunnerPreset> = {
  jest: {
    name: 'Jest',
    argv: ['npx', 'jest', '--coverage', '--coverageReporters=lcov'],
    scoped: (dir) => ({
      argv: ['npx', 'jest', '--coverage', '--coverageReporters=lcov', `--testPathPattern=${dir}`]
    }),
    outputGlob: 'coverage/lcov.info'
  },
  vitest: {
    name: 'Vitest',
    argv: ['npx', 'vitest', 'run', '--coverage', '--coverage.reporter=lcov'],
    scoped: (dir) => ({
      argv: ['npx', 'vitest', 'run', '--coverage', '--coverage.reporter=lcov', '--dir', dir]
    }),
    outputGlob: 'coverage/lcov.info'
  },
  pytest: {
    name: 'pytest',
    argv: ['python', '-m', 'pytest', '--cov=.', '--cov-report=lcov:lcov.info'],
    scoped: (dir) => ({
      argv: ['python', '-m', 'pytest', dir, '--cov=.', '--cov-report=lcov:lcov.info']
    }),
    outputGlob: 'lcov.info'
  },
  go: {
    name: 'Go test',
    argv: ['go', 'test', './...', '-coverprofile=coverage.out'],
    scoped: (dir) => ({
      argv: ['go', 'test', `./${dir.replace(/\\/g, '/')}/...`, '-coverprofile=coverage.out.partial']
    }),
    scopedOutput: 'coverage.out.partial',
    outputGlob: 'coverage.out'
  },
  cargo: {
    name: 'Cargo (tarpaulin)',
    argv: ['cargo', 'tarpaulin', '--out', 'Lcov', '--output-dir', '.'],
    outputGlob: 'lcov.info'
  },
  dotnet: {
    name: '.NET (coverlet)',
    argv: ['dotnet', 'test', '/p:CollectCoverage=true', '/p:CoverletOutputFormat=lcov', '/p:CoverletOutput=./lcov.info'],
    outputGlob: 'lcov.info'
  }
};

const detectCache = new Map<string, string>();

async function exists(p: string): Promise<boolean> {
  try { await fs.promises.access(p); return true; } catch { return false; }
}

async function hasFileWithExtension(dir: string, ext: string): Promise<boolean> {
  try {
    const entries = await fs.promises.readdir(dir);
    return entries.some(f => f.endsWith(ext));
  } catch {
    return false;
  }
}

/** Auto-detect runner from files present in workspaceRoot. Result is cached per workspace. */
export async function detectRunner(workspaceRoot: string): Promise<string> {
  const cached = detectCache.get(workspaceRoot);
  if (cached) return cached;

  const result = await detectRunnerImpl(workspaceRoot);
  detectCache.set(workspaceRoot, result);
  return result;
}

/** Clear cached detection (e.g. when workspace folders change). */
export function clearDetectCache(): void {
  detectCache.clear();
}

async function detectRunnerImpl(workspaceRoot: string): Promise<string> {
  const join = path.join;

  if (await exists(join(workspaceRoot, 'go.mod'))) return 'go';
  if (await exists(join(workspaceRoot, 'Cargo.toml'))) return 'cargo';

  if (await hasFileWithExtension(workspaceRoot, '.sln') ||
      await hasFileWithExtension(workspaceRoot, '.csproj')) return 'dotnet';

  if (await exists(join(workspaceRoot, 'pyproject.toml')) ||
      await exists(join(workspaceRoot, 'setup.cfg')) ||
      await exists(join(workspaceRoot, 'setup.py'))) return 'pytest';

  if (await exists(join(workspaceRoot, 'vitest.config.ts')) ||
      await exists(join(workspaceRoot, 'vitest.config.js')) ||
      await exists(join(workspaceRoot, 'vitest.config.mjs'))) return 'vitest';

  if (await exists(join(workspaceRoot, 'jest.config.js')) ||
      await exists(join(workspaceRoot, 'jest.config.ts')) ||
      await exists(join(workspaceRoot, 'jest.config.mjs'))) return 'jest';

  if (await exists(join(workspaceRoot, 'package.json'))) {
    try {
      const pkg = JSON.parse(await fs.promises.readFile(join(workspaceRoot, 'package.json'), 'utf8'));
      const testScript = pkg?.scripts?.test ?? '';
      if (testScript.includes('vitest')) return 'vitest';
      if (testScript.includes('jest')) return 'jest';
    } catch { /* ignore */ }
    return 'jest';
  }

  return 'jest';
}
