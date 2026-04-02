import { FileCoverage } from '../coverage/types';
import { DiffLine } from './gitDiff';

export function filterCoverageToDiff(
  coverage: Map<string, FileCoverage>,
  changedLines: DiffLine[],
): Map<string, FileCoverage> {
  const filtered = new Map<string, FileCoverage>();

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

    const filteredLines = fileCov.lines.filter(l => changedLineNumbers.has(l.lineNumber));
    const filteredBranches = fileCov.branches.filter(b => changedLineNumbers.has(b.lineNumber));

    if (filteredLines.length > 0) {
      const coveredCount = filteredLines.filter(l => l.executionCount > 0).length;
      filtered.set(filePath, {
        filePath,
        lines: filteredLines,
        branches: filteredBranches,
        lineRate: filteredLines.length > 0 ? coveredCount / filteredLines.length : 0,
        branchRate: fileCov.branchRate,
      });
    }
  }

  return filtered;
}
