import { parseStringPromise } from 'xml2js';
import { FileCoverage, LineCoverage } from '../types';

export async function parseJacoco(content: string, basePath: string): Promise<Map<string, FileCoverage>> {
  const files = new Map<string, FileCoverage>();
  const result = await parseStringPromise(content);
  const report = result.report;

  if (!report) {
    return files;
  }

  const packages = report.package ?? [];
  for (const pkg of packages) {
    const pkgName = pkg.$.name;
    const sourceFiles = pkg.sourcefile ?? [];

    for (const sourceFile of sourceFiles) {
      const fileName = sourceFile.$.name;
      const filePath = `${pkgName}/${fileName}`;
      const lines: LineCoverage[] = [];

      const fileLines = sourceFile.line ?? [];
      for (const line of fileLines) {
        const mi = Number(line.$.mi ?? 0);
        const ci = Number(line.$.ci ?? 0);
        lines.push({
          lineNumber: Number(line.$.nr),
          executionCount: ci > 0 ? ci : (mi > 0 ? 0 : -1),
        });
      }

      let lineRate = 0;
      let branchRate = 0;
      const counters = sourceFile.counter ?? [];
      for (const counter of counters) {
        const missed = Number(counter.$.missed);
        const covered = Number(counter.$.covered);
        const total = missed + covered;
        if (counter.$.type === 'LINE') {
          lineRate = total > 0 ? covered / total : 0;
        } else if (counter.$.type === 'BRANCH') {
          branchRate = total > 0 ? covered / total : 0;
        }
      }

      files.set(filePath, { filePath, lines, branches: [], lineRate, branchRate });
    }
  }

  return files;
}
