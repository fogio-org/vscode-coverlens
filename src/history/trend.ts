import { CoverageSnapshot } from '../coverage/types';

export interface CoverageDelta {
  previousPercent: number;
  currentPercent: number;
  delta: number;
  filesAdded: string[];
  filesRemoved: string[];
}

export function computeDelta(previous: CoverageSnapshot, current: CoverageSnapshot): CoverageDelta {
  const prevFiles = new Set(Object.keys(previous.files));
  const currFiles = new Set(Object.keys(current.files));

  const filesAdded = [...currFiles].filter(f => !prevFiles.has(f));
  const filesRemoved = [...prevFiles].filter(f => !currFiles.has(f));

  return {
    previousPercent: previous.totalLinePercent,
    currentPercent: current.totalLinePercent,
    delta: current.totalLinePercent - previous.totalLinePercent,
    filesAdded,
    filesRemoved,
  };
}
