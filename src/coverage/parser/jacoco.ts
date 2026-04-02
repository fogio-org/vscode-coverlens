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

      for (const ln of sf?.line ?? []) {
        const lineNo = parseInt(ln.$?.nr, 10);
        const ci = parseInt(ln.$?.ci, 10) || 0; // covered instructions
        const mi = parseInt(ln.$?.mi, 10) || 0; // missed instructions
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

      let covered = 0;
      for (const h of fc.lines.values()) if (h > 0) covered++;
      fc.metrics.totalLines = fc.lines.size;
      fc.metrics.coveredLines = covered;
      fc.metrics.linePercent = fc.metrics.totalLines === 0 ? 100
        : Math.round((covered / fc.metrics.totalLines) * 100);

      map.set(absPath, fc);
    }
  }
  return map;
}
