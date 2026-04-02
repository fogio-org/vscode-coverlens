export interface TestPreset {
  name: string;
  command: string;
  coverageArgs: string[];
  coverageOutput: string;
}

export const presets: TestPreset[] = [
  {
    name: 'jest',
    command: 'npx jest',
    coverageArgs: ['--coverage', '--coverageReporters=lcov'],
    coverageOutput: 'coverage/lcov.info',
  },
  {
    name: 'vitest',
    command: 'npx vitest run',
    coverageArgs: ['--coverage'],
    coverageOutput: 'coverage/lcov.info',
  },
  {
    name: 'pytest',
    command: 'pytest',
    coverageArgs: ['--cov', '--cov-report=xml:coverage.xml'],
    coverageOutput: 'coverage.xml',
  },
  {
    name: 'go',
    command: 'go test',
    coverageArgs: ['-coverprofile=coverage.out', './...'],
    coverageOutput: 'coverage.out',
  },
  {
    name: 'cargo',
    command: 'cargo tarpaulin',
    coverageArgs: ['--out', 'Lcov'],
    coverageOutput: 'lcov.info',
  },
];

export function detectPreset(workspaceRoot: string): TestPreset | undefined {
  // Detection would check for package.json (jest/vitest), setup.py/pyproject.toml (pytest), etc.
  // Stub for now — will be expanded
  return undefined;
}
