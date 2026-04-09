import * as fs from 'fs';
import { parseStringPromise } from 'xml2js';
import { FileCoverage, CoverageMap } from '../types';
import { resolveFilePath } from '../../util/paths';

export async function parseJacoco(filePath: string, workspaceRoot: string): Promise<CoverageMap> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const xml = await parseStringPromise(content, { explicitArray: true });
  const map: CoverageMap = new Map();

  const packages = xml?.report?.package ?? [];
  for (const pkg of packages) {
    const srcFiles = pkg?.sourcefile ?? [];
    for (const sf of srcFiles) {
      const name = sf.$?.name ?? '';
      const pkgName = (pkg.$?.name ?? '').replace(/\//g, '/');
      const rel = pkgName ? `${pkgName}/${name}` : name;
      const absPath = resolveFilePath(rel, workspaceRoot);

      const fc: FileCoverage = {
        filePath: absPath,
        lines: new Map(),
        branches: new Map(),
        metrics: { totalLines: 0, coveredLines: 0, totalBranches: 0, coveredBranches: 0, partialBranches: 0, linePercent: 0, branchPercent: 0 }
      };

      // Parse individual lines for decorations
      for (const ln of sf?.line ?? []) {
        const lineNo = parseInt(ln.$?.nr, 10);
        const ci = parseInt(ln.$?.ci, 10) || 0; // covered instructions
        fc.lines.set(lineNo, ci > 0 ? ci : 0);

        const cb = parseInt(ln.$?.cb, 10) || 0;
        const mb = parseInt(ln.$?.mb, 10) || 0;
        if (cb + mb > 0) {
          const total = cb + mb;
          const bds = Array.from({ length: total }, (_, i) => ({
            lineNumber: lineNo, blockNumber: 0, branchNumber: i, taken: i < cb ? 1 : 0
          }));
          fc.branches.set(lineNo, bds);
        }
      }

      // Use JaCoCo's own LINE and BRANCH counters for metrics
      // These match what JaCoCo reports in HTML/CSV/XML summaries
      const counters = sf?.counter ?? [];
      for (const c of counters) {
        const type = c.$?.type;
        const missed = parseInt(c.$?.missed, 10) || 0;
        const covered = parseInt(c.$?.covered, 10) || 0;

        if (type === 'LINE') {
          fc.metrics.totalLines = missed + covered;
          fc.metrics.coveredLines = covered;
          fc.metrics.linePercent = (missed + covered) === 0 ? 100
            : Math.round((covered / (missed + covered)) * 100);
        } else if (type === 'BRANCH') {
          fc.metrics.totalBranches = missed + covered;
          fc.metrics.coveredBranches = covered;
          fc.metrics.branchPercent = (missed + covered) === 0 ? 100
            : Math.round((covered / (missed + covered)) * 100);
        }
      }

      // Compute partial branches from line-level data (not in counters)
      let partialBranches = 0;
      for (const bds of fc.branches.values()) {
        const taken = bds.filter(b => b.taken > 0).length;
        if (taken > 0 && taken < bds.length) partialBranches++;
      }
      fc.metrics.partialBranches = partialBranches;

      // Fallback: if no LINE counter in XML, compute from lines map
      if (fc.metrics.totalLines === 0 && fc.lines.size > 0) {
        let covered = 0;
        for (const h of fc.lines.values()) if (h > 0) covered++;
        fc.metrics.totalLines = fc.lines.size;
        fc.metrics.coveredLines = covered;
        fc.metrics.linePercent = Math.round((covered / fc.lines.size) * 100);
      }

      map.set(absPath, fc);
    }
  }
  return map;
}
