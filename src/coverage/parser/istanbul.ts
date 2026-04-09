import * as fs from 'fs';
import { FileCoverage, CoverageMap } from '../types';
import { resolveFilePath } from '../../util/paths';

/**
 * Parse Istanbul / NYC JSON coverage format (coverage.json, coverage-final.json).
 *
 * Structure: { "/abs/path/file.js": { statementMap, s, branchMap, b, fnMap, f }, ... }
 */
export async function parseIstanbul(filePath: string, workspaceRoot: string): Promise<CoverageMap> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const data = JSON.parse(content);
  const map: CoverageMap = new Map();

  for (const [rawPath, entry] of Object.entries(data) as [string, any][]) {
    const absPath = await resolveFilePath(rawPath, workspaceRoot);

    const fc: FileCoverage = {
      filePath: absPath,
      lines: new Map(),
      branches: new Map(),
      metrics: { totalLines: 0, coveredLines: 0, totalBranches: 0, coveredBranches: 0, partialBranches: 0, linePercent: 0, branchPercent: 0 }
    };

    // Statement coverage → line coverage
    if (entry.statementMap && entry.s) {
      for (const [id, count] of Object.entries(entry.s) as [string, number][]) {
        const stmt = entry.statementMap[id];
        if (!stmt) continue;
        const startLine = stmt.start?.line;
        if (typeof startLine !== 'number') continue;
        // Use max of existing hits and statement hits (multiple statements per line)
        const existing = fc.lines.get(startLine) ?? 0;
        fc.lines.set(startLine, Math.max(existing, count));
      }
    }

    // Branch coverage
    if (entry.branchMap && entry.b) {
      for (const [id, counts] of Object.entries(entry.b) as [string, number[]][]) {
        const branch = entry.branchMap[id];
        if (!branch) continue;
        const lineNo = branch.loc?.start?.line ?? branch.locations?.[0]?.start?.line;
        if (typeof lineNo !== 'number') continue;

        const branchData = counts.map((taken, i) => ({
          lineNumber: lineNo,
          blockNumber: 0,
          branchNumber: i,
          taken
        }));

        const existing = fc.branches.get(lineNo) ?? [];
        fc.branches.set(lineNo, [...existing, ...branchData]);
      }
    }

    // Compute metrics
    let coveredLines = 0;
    for (const hits of fc.lines.values()) {
      if (hits > 0) coveredLines++;
    }
    fc.metrics.totalLines = fc.lines.size;
    fc.metrics.coveredLines = coveredLines;
    fc.metrics.linePercent = fc.metrics.totalLines === 0 ? 100
      : Math.round((coveredLines / fc.metrics.totalLines) * 100);

    let totalBranches = 0;
    let coveredBranches = 0;
    let partialBranches = 0;
    for (const bds of fc.branches.values()) {
      totalBranches += bds.length;
      const taken = bds.filter(b => b.taken > 0).length;
      coveredBranches += taken;
      if (taken > 0 && taken < bds.length) partialBranches++;
    }
    fc.metrics.totalBranches = totalBranches;
    fc.metrics.coveredBranches = coveredBranches;
    fc.metrics.partialBranches = partialBranches;
    fc.metrics.branchPercent = totalBranches === 0 ? 100
      : Math.round((coveredBranches / totalBranches) * 100);

    map.set(absPath, fc);
  }

  return map;
}
