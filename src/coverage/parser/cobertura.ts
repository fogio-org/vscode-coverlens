import * as fs from 'fs';
import { parseStringPromise } from 'xml2js';
import { FileCoverage, CoverageMap } from '../types';
import { resolveFilePath } from '../../util/paths';

export async function parseCobertura(filePath: string, workspaceRoot: string): Promise<CoverageMap> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const xml = await parseStringPromise(content, { explicitArray: true });
  const map: CoverageMap = new Map();

  const packages = xml?.coverage?.packages?.[0]?.package ?? [];
  for (const pkg of packages) {
    const classes = pkg?.classes?.[0]?.class ?? [];
    for (const cls of classes) {
      const filename = cls.$?.filename ?? '';
      if (!filename) continue;
      const absPath = resolveFilePath(filename, workspaceRoot);
      const fc: FileCoverage = {
        filePath: absPath,
        lines: new Map(),
        branches: new Map(),
        metrics: { totalLines: 0, coveredLines: 0, totalBranches: 0, coveredBranches: 0, partialBranches: 0, linePercent: 0, branchPercent: 0 }
      };

      const lines = cls?.lines?.[0]?.line ?? [];
      for (const ln of lines) {
        const lineNo = parseInt(ln.$?.number, 10);
        const hits = parseInt(ln.$?.hits, 10) || 0;
        if (!isNaN(lineNo)) fc.lines.set(lineNo, hits);

        // Cobertura branch data: condition-coverage="50% (1/2)"
        const condCov = ln.$?.['condition-coverage'] ?? '';
        if (condCov && ln.$?.branch === 'true') {
          const m = condCov.match(/\((\d+)\/(\d+)\)/);
          if (m) {
            const taken = parseInt(m[1], 10);
            const total = parseInt(m[2], 10);
            const bds = Array.from({ length: total }, (_, i) => ({
              lineNumber: lineNo, blockNumber: 0, branchNumber: i, taken: i < taken ? 1 : 0
            }));
            fc.branches.set(lineNo, bds);
          }
        }
      }

      // Re-compute metrics
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
