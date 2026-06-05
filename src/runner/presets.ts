import * as fs from 'fs';
import * as path from 'path';

export interface ScopedRun {
  /** Argv (first element is the executable, rest are args). Pass with shell:true for cross-platform binary resolution. */
  argv: string[];
  /** Optional second command (e.g. format raw Dart coverage to LCOV). */
  followUpArgv?: string[];
}

export interface RunnerPreset {
  name: string;
  /** Argv for running ALL tests and outputting a coverage file */
  argv: string[];
  /** Optional second command after the main test run (e.g. Dart coverage formatting). */
  followUpArgv?: string[];
  /** Builder for argv scoped to a specific directory (relative to workspace root) */
  scoped?: (relativeDir: string) => ScopedRun;
  /** If scoped run writes to a separate file, specify it here for merging */
  scopedOutput?: string;
  /** Expected coverage output glob (relative to workspace root) */
  outputGlob: string;
}

/**
 * `dart test --coverage=coverage` writes a directory of raw VM hit-map JSON
 * files rather than LCOV (unlike `flutter test --coverage`, which emits LCOV
 * directly). This command converts those JSON files into an LCOV file that
 * CoverLens can read.
 *
 * `--package=.` resolves package URIs from the current package root — the
 * modern replacement for the deprecated `--packages <package_config.json>`
 * flag. `--report-on=lib` restricts the report to library sources, the Dart
 * community convention. Requires the `coverage` package as a dev_dependency.
 */
const DART_FORMAT_COVERAGE: string[] = [
  'dart', 'run', 'coverage:format_coverage',
  '--lcov',
  '--in=coverage',
  '--out=coverage/lcov.info',
  '--report-on=lib',
  '--package=.'
];

/**
 * Dart and Flutter tests all live under `test/`, and there is no reliable way
 * to map an edited `lib/` file back to a single test file. A scoped run
 * therefore targets the saved file's own directory when it already sits inside
 * `test/`, and falls back to the whole `test/` directory otherwise — keeping
 * on-save runs fast without guessing which tests to run.
 */
function scopedTestTarget(relativeDir: string): string {
  return relativeDir.split(path.sep)[0] === 'test' ? relativeDir : 'test';
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
  },
  flutter: {
    name: 'Flutter test',
    // `flutter test --coverage` emits coverage/lcov.info directly.
    argv: ['flutter', 'test', '--coverage'],
    scoped: (dir) => ({
      argv: ['flutter', 'test', '--coverage', scopedTestTarget(dir)]
    }),
    outputGlob: 'coverage/lcov.info'
  },
  dart: {
    name: 'Dart test',
    // Raw JSON hit-maps are written to coverage/, then formatted to LCOV.
    argv: ['dart', 'test', '--coverage=coverage'],
    followUpArgv: DART_FORMAT_COVERAGE,
    scoped: (dir) => ({
      argv: ['dart', 'test', '--coverage=coverage', scopedTestTarget(dir)],
      followUpArgv: DART_FORMAT_COVERAGE
    }),
    outputGlob: 'coverage/lcov.info'
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

/**
 * A Flutter package pulls in the Flutter SDK via an `sdk: flutter` line (under
 * dependencies or dev_dependencies); pure Dart packages never do. We match that
 * line directly instead of parsing YAML, to avoid taking on a YAML dependency
 * for a single detection heuristic. The anchors keep it from matching the
 * substring inside an unrelated value.
 */
function isFlutterPubspec(content: string): boolean {
  return /^\s*sdk:\s*flutter\s*$/m.test(content);
}

async function detectRunnerImpl(workspaceRoot: string): Promise<string> {
  const join = path.join;

  const pubspecPath = join(workspaceRoot, 'pubspec.yaml');
  if (await exists(pubspecPath)) {
    try {
      const content = await fs.promises.readFile(pubspecPath, 'utf8');
      return isFlutterPubspec(content) ? 'flutter' : 'dart';
    } catch { /* fall through */ }
  }

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
