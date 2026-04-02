import { parseStringPromise } from 'xml2js';
import { FileCoverage, LineCoverage } from '../types';

export async function parseClover(content: string, basePath: string): Promise<Map<string, FileCoverage>> {
  const files = new Map<string, FileCoverage>();
  const result = await parseStringPromise(content);
  const project = result.coverage?.project?.[0];

  if (!project) {
    return files;
  }

  const packages = project.package ?? [];
  for (const pkg of packages) {
    const fileEntries = pkg.file ?? [];
    for (const file of fileEntries) {
      const filePath = file.$.path ?? file.$.name;
      const lines: LineCoverage[] = [];

      const fileLines = file.line ?? [];
      for (const line of fileLines) {
        lines.push({
          lineNumber: Number(line.$.num),
          executionCount: Number(line.$.count),
        });
      }

      const metrics = file.metrics?.[0]?.$;
      const statements = Number(metrics?.statements ?? 0);
      const coveredStatements = Number(metrics?.coveredstatements ?? 0);
      const conditionals = Number(metrics?.conditionals ?? 0);
      const coveredConditionals = Number(metrics?.coveredconditionals ?? 0);

      files.set(filePath, {
        filePath,
        lines,
        branches: [],
        lineRate: statements > 0 ? coveredStatements / statements : 0,
        branchRate: conditionals > 0 ? coveredConditionals / conditionals : 0,
      });
    }
  }

  return files;
}
