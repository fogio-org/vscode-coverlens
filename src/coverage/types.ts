/** One branch point on a line */
export interface BranchData {
  lineNumber: number;
  blockNumber: number;
  branchNumber: number;
  taken: number; // 0 = not taken, >0 = taken N times
}

/** Coverage data for a single source file */
export interface FileCoverage {
  /** Absolute path, normalized with forward slashes */
  filePath: string;
  /** line number → hit count (0 = uncovered, >0 = covered N times) */
  lines: Map<number, number>;
  /** line number → branch data array */
  branches: Map<number, BranchData[]>;
  /** Computed metrics */
  metrics: {
    totalLines: number;
    coveredLines: number;
    totalBranches: number;
    coveredBranches: number;
    partialBranches: number; // lines where SOME branches covered, not all
    linePercent: number;
    branchPercent: number;
  };
}

/** Line coverage state — three states, not two */
export type LineState = 'covered' | 'partial' | 'uncovered' | 'ignored';

/** Full project coverage map, keyed by normalized absolute file path */
export type CoverageMap = Map<string, FileCoverage>;

/** A snapshot saved to history */
export interface CoverageSnapshot {
  timestamp: number;
  commitHash?: string;
  totalLinePercent: number;
  totalBranchPercent: number;
  files: Record<string, { linePercent: number; branchPercent: number }>;
}
