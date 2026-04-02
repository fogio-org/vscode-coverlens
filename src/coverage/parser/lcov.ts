import * as fs from 'fs';
import { FileCoverage, BranchData, CoverageMap } from '../types';
import { resolveFilePath } from '../../util/paths';

/** Parse one or more lcov.info files and merge into a CoverageMap */
export async function parseLcov(filePath: string, workspaceRoot: string): Promise<CoverageMap> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const map: CoverageMap = new Map();

  let current: FileCoverage | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (line.startsWith('SF:')) {
      const sourcePath = resolveFilePath(line.slice(3), workspaceRoot);
      current = {
        filePath: sourcePath,
        lines: new Map(),
        branches: new Map(),
        metrics: { totalLines: 0, coveredLines: 0, totalBranches: 0, coveredBranches: 0, partialBranches: 0, linePercent: 0, branchPercent: 0 }
      };

    } else if (line.startsWith('DA:') && current) {
      // DA:<line>,<hits>
      const [lineNum, hits] = line.slice(3).split(',').map(Number);
      if (!isNaN(lineNum)) current.lines.set(lineNum, hits ?? 0);

    } else if (line.startsWith('BRDA:') && current) {
      // BRDA:<line>,<block>,<branch>,<taken>
      const parts = line.slice(5).split(',');
      const [lineNum, block, branch, takenRaw] = parts;
      const taken = takenRaw === '-' ? 0 : parseInt(takenRaw, 10);
      const bd: BranchData = {
        lineNumber: parseInt(lineNum, 10),
        blockNumber: parseInt(block, 10),
        branchNumber: parseInt(branch, 10),
        taken
      };
      const lineNo = parseInt(lineNum, 10);
      if (!current.branches.has(lineNo)) current.branches.set(lineNo, []);
      current.branches.get(lineNo)!.push(bd);

    } else if (line === 'end_of_record' && current) {
      computeMetrics(current);
      const existing = map.get(current.filePath);
      if (existing) {
        mergeCoverage(existing, current);
      } else {
        map.set(current.filePath, current);
      }
      current = null;
    }
  }

  return map;
}

function computeMetrics(fc: FileCoverage): void {
  let covered = 0;
  for (const hits of fc.lines.values()) {
    if (hits > 0) covered++;
  }
  fc.metrics.totalLines = fc.lines.size;
  fc.metrics.coveredLines = covered;
  fc.metrics.linePercent = fc.metrics.totalLines === 0 ? 100
    : Math.round((covered / fc.metrics.totalLines) * 100);

  let totalBr = 0, coveredBr = 0;
  const partialLines = new Set<number>();
  for (const [lineNo, bds] of fc.branches) {
    totalBr += bds.length;
    const takenCount = bds.filter(b => b.taken > 0).length;
    coveredBr += takenCount;
    if (takenCount > 0 && takenCount < bds.length) partialLines.add(lineNo);
  }
  fc.metrics.totalBranches = totalBr;
  fc.metrics.coveredBranches = coveredBr;
  fc.metrics.partialBranches = partialLines.size;
  fc.metrics.branchPercent = totalBr === 0 ? 100
    : Math.round((coveredBr / totalBr) * 100);
}

function mergeCoverage(target: FileCoverage, source: FileCoverage): void {
  for (const [line, hits] of source.lines) {
    target.lines.set(line, (target.lines.get(line) ?? 0) + hits);
  }
  for (const [line, bds] of source.branches) {
    if (!target.branches.has(line)) {
      target.branches.set(line, [...bds]);
    } else {
      const existing = target.branches.get(line)!;
      bds.forEach((bd, i) => {
        if (existing[i]) existing[i].taken += bd.taken;
        else existing.push({ ...bd });
      });
    }
  }
  computeMetrics(target);
}
