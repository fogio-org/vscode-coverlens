import { FileCoverage, LineCoverage, BranchCoverage } from '../types';

export function parseLcov(content: string, basePath: string): Map<string, FileCoverage> {
  const files = new Map<string, FileCoverage>();
  const records = content.split('end_of_record').filter(r => r.trim());

  for (const record of records) {
    const lines: LineCoverage[] = [];
    const branches: BranchCoverage[] = [];
    let filePath = '';
    let linesFound = 0;
    let linesHit = 0;
    let branchesFound = 0;
    let branchesHit = 0;

    for (const line of record.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('SF:')) {
        filePath = trimmed.slice(3);
      } else if (trimmed.startsWith('DA:')) {
        const [lineNo, count] = trimmed.slice(3).split(',').map(Number);
        lines.push({ lineNumber: lineNo, executionCount: count });
      } else if (trimmed.startsWith('BRDA:')) {
        const parts = trimmed.slice(5).split(',');
        branches.push({
          lineNumber: Number(parts[0]),
          blockNumber: Number(parts[1]),
          branchNumber: Number(parts[2]),
          taken: parts[3] === '-' ? 0 : Number(parts[3]),
        });
      } else if (trimmed.startsWith('LF:')) {
        linesFound = Number(trimmed.slice(3));
      } else if (trimmed.startsWith('LH:')) {
        linesHit = Number(trimmed.slice(3));
      } else if (trimmed.startsWith('BRF:')) {
        branchesFound = Number(trimmed.slice(4));
      } else if (trimmed.startsWith('BRH:')) {
        branchesHit = Number(trimmed.slice(4));
      }
    }

    if (filePath) {
      files.set(filePath, {
        filePath,
        lines,
        branches,
        lineRate: linesFound > 0 ? linesHit / linesFound : 0,
        branchRate: branchesFound > 0 ? branchesHit / branchesFound : 0,
      });
    }
  }

  return files;
}
