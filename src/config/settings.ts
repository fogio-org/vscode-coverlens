import * as vscode from 'vscode';

export interface CoverLensSettings {
  enabled: boolean;
  coverageFiles: string[];
  excludePatterns: string[];
  colorCovered: string;
  colorPartial: string;
  colorUncovered: string;
  decorationStyle: 'gutter' | 'line' | 'both';
  diffMode: boolean;
  diffBase: string;
  thresholdLow: number;
  thresholdMedium: number;
  testRunner: string;
  testRunnerCustomCommand: string;
  monorepoEnabled: boolean;
  monorepoPackages: string[];
  historyEnabled: boolean;
  historyMaxSnapshots: number;
}

export function getSettings(): CoverLensSettings {
  const config = vscode.workspace.getConfiguration('coverlens');
  return {
    enabled: config.get<boolean>('enabled', true),
    coverageFiles: config.get<string[]>('coverageFiles', [
      '**/lcov.info',
      '**/coverage.xml',
      '**/cov.xml',
      '**/coverage.cobertura.xml',
      '**/jacoco.xml',
      '**/clover.xml',
    ]),
    excludePatterns: config.get<string[]>('excludePatterns', [
      '**/node_modules/**',
      '**/.venv/**',
      '**/vendor/**',
      '**/dist/**',
    ]),
    colorCovered: config.get<string>('colors.covered', ''),
    colorPartial: config.get<string>('colors.partial', ''),
    colorUncovered: config.get<string>('colors.uncovered', ''),
    decorationStyle: config.get<'gutter' | 'line' | 'both'>('decorationStyle', 'line'),
    diffMode: config.get<boolean>('diffMode', false),
    diffBase: config.get<string>('diffBase', 'HEAD'),
    thresholdLow: config.get<number>('thresholds.low', 50),
    thresholdMedium: config.get<number>('thresholds.medium', 80),
    testRunner: config.get<string>('testRunner', 'auto'),
    testRunnerCustomCommand: config.get<string>('testRunner.customCommand', ''),
    monorepoEnabled: config.get<boolean>('monorepo.enabled', true),
    monorepoPackages: config.get<string[]>('monorepo.packages', []),
    historyEnabled: config.get<boolean>('history.enabled', true),
    historyMaxSnapshots: config.get<number>('history.maxSnapshots', 50),
  };
}
