import { FileCoverage, CoverageMap } from '../coverage/types';
import { DiffLine } from './gitDiff';

export function filterCoverageToDiff(
  coverage: CoverageMap,
  changedLines: DiffLine[],
): CoverageMap {
  const filtered: CoverageMap = new Map();

  const changesByFile = new Map<string, Set<number>>();
  for (const diff of changedLines) {
    let lines = changesByFile.get(diff.filePath);
    if (!lines) {
      lines = new Set();
      changesByFile.set(diff.filePath, lines);
    }
    lines.add(diff.lineNumber);
  }

  for (const [filePath, fileCov] of coverage) {
    const changedLineNumbers = changesByFile.get(filePath);
    if (!changedLineNumbers) {
      continue;
    }

    const filteredLines = new Map<number, number>();
    for (const [lineNo, hits] of fileCov.lines) {
      if (changedLineNumbers.has(lineNo)) {
        filteredLines.set(lineNo, hits);
      }
    }

    const filteredBranches = new Map<number, typeof fileCov.branches extends Map<number, infer V> ? V : never>();
    for (const [lineNo, bds] of fileCov.branches) {
      if (changedLineNumbers.has(lineNo)) {
        filteredBranches.set(lineNo, bds);
      }
    }

    if (filteredLines.size > 0) {
      let coveredCount = 0;
      for (const hits of filteredLines.values()) {
        if (hits > 0) coveredCount++;
      }
      filtered.set(filePath, {
        filePath,
        lines: filteredLines,
        branches: filteredBranches,
        metrics: {
          totalLines: filteredLines.size,
          coveredLines: coveredCount,
          totalBranches: 0,
          coveredBranches: 0,
          partialBranches: 0,
          linePercent: filteredLines.size > 0 ? Math.round((coveredCount / filteredLines.size) * 100) : 100,
          branchPercent: 0,
        },
      });
    }
  }

  return filtered;
}
