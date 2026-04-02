import * as fs from 'fs';
import * as path from 'path';
import { FileCoverage, CoverageMap } from '../types';
import { normalizePath } from '../../util/paths';

/**
 * Parse Go coverage profile (coverage.out) format.
 * Format: mode: set|count|atomic
 * Then lines like: github.com/user/pkg/file.go:10.2,12.0 1 5
 * meaning file.go lines 10-12, 1 statement, hit 5 times
 */
export async function parseGoCover(filePath: string, workspaceRoot: string): Promise<CoverageMap> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const map: CoverageMap = new Map();

  // Read module name from go.mod to strip module prefix from coverage paths
  const moduleName = readModuleName(workspaceRoot);

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('mode:')) continue;

    // format: file:startLine.startCol,endLine.endCol numStatements count
    const match = trimmed.match(/^(.+):(\d+)\.\d+,(\d+)\.\d+\s+(\d+)\s+(\d+)$/);
    if (!match) continue;

    const [, rawFile, startStr, endStr, , countStr] = match;
    const startLine = parseInt(startStr, 10);
    const endLine = parseInt(endStr, 10);
    const count = parseInt(countStr, 10);

    // Strip module prefix to get a workspace-relative path
    const absPath = resolveGoPath(rawFile, moduleName, workspaceRoot);

    let fc = map.get(absPath);
    if (!fc) {
      fc = {
        filePath: absPath,
        lines: new Map(),
        branches: new Map(),
        metrics: { totalLines: 0, coveredLines: 0, totalBranches: 0, coveredBranches: 0, partialBranches: 0, linePercent: 0, branchPercent: 0 }
      };
      map.set(absPath, fc);
    }

    for (let l = startLine; l <= endLine; l++) {
      const existing = fc.lines.get(l) ?? 0;
      fc.lines.set(l, existing + count);
    }
  }

  // Compute metrics for all files
  for (const fc of map.values()) {
    let covered = 0;
    for (const hits of fc.lines.values()) {
      if (hits > 0) covered++;
    }
    fc.metrics.totalLines = fc.lines.size;
    fc.metrics.coveredLines = covered;
    fc.metrics.linePercent = fc.metrics.totalLines === 0 ? 100
      : Math.round((covered / fc.metrics.totalLines) * 100);
  }

  return map;
}

/** Read module name from go.mod (e.g. "github.com/fogio-org/food-api") */
function readModuleName(workspaceRoot: string): string {
  try {
    const goModPath = path.join(workspaceRoot, 'go.mod');
    const content = fs.readFileSync(goModPath, 'utf8');
    const match = content.match(/^module\s+(\S+)/m);
    if (match) return match[1];
  } catch {
    // go.mod not found or unreadable
  }
  return '';
}

/** Convert Go module path to absolute filesystem path */
function resolveGoPath(goPath: string, moduleName: string, workspaceRoot: string): string {
  let relativePath = goPath;

  // Strip module prefix: "github.com/user/pkg/internal/foo.go" → "internal/foo.go"
  if (moduleName && goPath.startsWith(moduleName)) {
    relativePath = goPath.slice(moduleName.length);
    // Remove leading slash
    if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
  }

  return normalizePath(path.resolve(workspaceRoot, relativePath));
}
