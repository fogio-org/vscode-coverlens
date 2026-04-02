import * as vscode from 'vscode';

export interface CoverLensSettings {
  coveragePaths: string[];
  autoWatch: boolean;
  diffCoverageEnabled: boolean;
  diffBase: string;
  decorationStyle: 'gutter' | 'highlight' | 'both';
}

export function getSettings(): CoverLensSettings {
  const config = vscode.workspace.getConfiguration('coverlens');
  return {
    coveragePaths: config.get<string[]>('coveragePaths', ['coverage/lcov.info', 'coverage/cobertura.xml']),
    autoWatch: config.get<boolean>('autoWatch', true),
    diffCoverageEnabled: config.get<boolean>('diffCoverage.enabled', false),
    diffBase: config.get<string>('diffCoverage.base', 'HEAD'),
    decorationStyle: config.get<'gutter' | 'highlight' | 'both'>('decorationStyle', 'both'),
  };
}
