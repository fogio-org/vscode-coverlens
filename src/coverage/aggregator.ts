import { CoverageData, FileCoverage } from './types';

export function aggregateCoverage(datasets: CoverageData[]): CoverageData {
  const merged = new Map<string, FileCoverage>();

  for (const data of datasets) {
    for (const [filePath, coverage] of data.files) {
      const existing = merged.get(filePath);
      if (!existing) {
        merged.set(filePath, { ...coverage });
      } else {
        // Merge line coverage by taking max execution count
        const lineMap = new Map(existing.lines.map(l => [l.lineNumber, l]));
        for (const line of coverage.lines) {
          const prev = lineMap.get(line.lineNumber);
          if (!prev) {
            lineMap.set(line.lineNumber, { ...line });
          } else {
            prev.executionCount = Math.max(prev.executionCount, line.executionCount);
          }
        }
        existing.lines = Array.from(lineMap.values());

        // Merge branch coverage
        existing.branches = [...existing.branches, ...coverage.branches];

        // Recalculate rates
        const totalLines = existing.lines.length;
        const coveredLines = existing.lines.filter(l => l.executionCount > 0).length;
        existing.lineRate = totalLines > 0 ? coveredLines / totalLines : 0;
      }
    }
  }

  return {
    files: merged,
    timestamp: Date.now(),
    source: 'aggregated',
  };
}
