import { CoverageData } from '../coverage/types';

export interface CoverageDelta {
  previousRate: number;
  currentRate: number;
  delta: number;
  filesAdded: string[];
  filesRemoved: string[];
}

export function computeDelta(previous: CoverageData, current: CoverageData): CoverageDelta {
  const prevRate = computeOverallRate(previous);
  const currRate = computeOverallRate(current);

  const prevFiles = new Set(previous.files.keys());
  const currFiles = new Set(current.files.keys());

  const filesAdded = [...currFiles].filter(f => !prevFiles.has(f));
  const filesRemoved = [...prevFiles].filter(f => !currFiles.has(f));

  return {
    previousRate: prevRate,
    currentRate: currRate,
    delta: currRate - prevRate,
    filesAdded,
    filesRemoved,
  };
}

function computeOverallRate(data: CoverageData): number {
  let totalLines = 0;
  let coveredLines = 0;

  for (const file of data.files.values()) {
    totalLines += file.lines.length;
    coveredLines += file.lines.filter(l => l.executionCount > 0).length;
  }

  return totalLines > 0 ? coveredLines / totalLines : 0;
}
