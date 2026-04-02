export interface LineCoverage {
  lineNumber: number;
  executionCount: number;
}

export interface BranchCoverage {
  lineNumber: number;
  blockNumber: number;
  branchNumber: number;
  taken: number;
}

export interface FileCoverage {
  filePath: string;
  lines: LineCoverage[];
  branches: BranchCoverage[];
  lineRate: number;
  branchRate: number;
}

export interface CoverageData {
  files: Map<string, FileCoverage>;
  timestamp: number;
  source: string;
}

export enum CoverageState {
  Covered = 'covered',
  Partial = 'partial',
  Uncovered = 'uncovered',
}

export type CoverageFormat = 'lcov' | 'cobertura' | 'clover' | 'jacoco';
