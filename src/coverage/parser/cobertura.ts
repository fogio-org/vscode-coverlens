import { parseStringPromise } from 'xml2js';
import { FileCoverage, LineCoverage, BranchCoverage } from '../types';

export async function parseCobertura(content: string, basePath: string): Promise<Map<string, FileCoverage>> {
  const files = new Map<string, FileCoverage>();
  const result = await parseStringPromise(content);
  const coverage = result.coverage;

  if (!coverage?.packages) {
    return files;
  }

  const packages = coverage.packages[0]?.package ?? [];
  for (const pkg of packages) {
    const classes = pkg.classes?.[0]?.class ?? [];
    for (const cls of classes) {
      const filePath = cls.$.filename;
      const lines: LineCoverage[] = [];
      const branches: BranchCoverage[] = [];

      const clsLines = cls.lines?.[0]?.line ?? [];
      for (const line of clsLines) {
        const lineNumber = Number(line.$.number);
        const hits = Number(line.$.hits);
        lines.push({ lineNumber, executionCount: hits });

        if (line.$['condition-coverage']) {
          const match = line.$['condition-coverage'].match(/\((\d+)\/(\d+)\)/);
          if (match) {
            const taken = Number(match[1]);
            const total = Number(match[2]);
            for (let i = 0; i < total; i++) {
              branches.push({
                lineNumber,
                blockNumber: 0,
                branchNumber: i,
                taken: i < taken ? 1 : 0,
              });
            }
          }
        }
      }

      const lineRate = Number(cls.$['line-rate'] ?? 0);
      const branchRate = Number(cls.$['branch-rate'] ?? 0);

      files.set(filePath, { filePath, lines, branches, lineRate, branchRate });
    }
  }

  return files;
}
