export interface RunnerPreset {
  name: string;
  /** Shell command that runs ALL tests and outputs a coverage file */
  command: string;
  /** Command template for running tests scoped to a specific directory/package */
  scopedCommand?: (relativeDir: string) => string;
  /** Expected coverage output glob (relative to workspace root) */
  outputGlob: string;
}

export const PRESETS: Record<string, RunnerPreset> = {
  jest: {
    name: 'Jest',
    command: 'npx jest --coverage --coverageReporters=lcov',
    scopedCommand: (dir) => `npx jest --coverage --coverageReporters=lcov --testPathPattern="${dir}"`,
    outputGlob: 'coverage/lcov.info'
  },
  vitest: {
    name: 'Vitest',
    command: 'npx vitest run --coverage --coverage.reporter=lcov',
    scopedCommand: (dir) => `npx vitest run --coverage --coverage.reporter=lcov --dir "${dir}"`,
    outputGlob: 'coverage/lcov.info'
  },
  pytest: {
    name: 'pytest',
    command: 'python -m pytest --cov=. --cov-report=lcov:lcov.info',
    scopedCommand: (dir) => `python -m pytest "${dir}" --cov=. --cov-report=lcov:lcov.info`,
    outputGlob: 'lcov.info'
  },
  go: {
    name: 'Go test',
    command: 'go test ./... -coverprofile=coverage.out',
    scopedCommand: (dir) => `go test ./${dir}/... -coverprofile=coverage.out`,
    outputGlob: 'coverage.out'
  },
  cargo: {
    name: 'Cargo (tarpaulin)',
    command: 'cargo tarpaulin --out Lcov --output-dir .',
    outputGlob: 'lcov.info'
  },
  dotnet: {
    name: '.NET (coverlet)',
    command: 'dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=lcov /p:CoverletOutput=./lcov.info',
    outputGlob: 'lcov.info'
  }
};

/** Auto-detect runner from files present in workspaceRoot */
export async function detectRunner(workspaceRoot: string): Promise<string> {
  const fs = await import('fs');
  const join = (await import('path')).join;

  if (fs.existsSync(join(workspaceRoot, 'jest.config.js')) ||
      fs.existsSync(join(workspaceRoot, 'jest.config.ts'))) return 'jest';

  if (fs.existsSync(join(workspaceRoot, 'vitest.config.ts')) ||
      fs.existsSync(join(workspaceRoot, 'vitest.config.js'))) return 'vitest';

  if (fs.existsSync(join(workspaceRoot, 'pyproject.toml')) ||
      fs.existsSync(join(workspaceRoot, 'setup.cfg'))) return 'pytest';

  if (fs.existsSync(join(workspaceRoot, 'go.mod'))) return 'go';
  if (fs.existsSync(join(workspaceRoot, 'Cargo.toml'))) return 'cargo';

  return 'jest'; // safe default
}
