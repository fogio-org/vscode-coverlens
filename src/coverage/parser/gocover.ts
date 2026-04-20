import * as fs from 'fs';
import * as path from 'path';
import { CoverageMap } from '../types';
import { normalizePath } from '../../util/paths';

/**
 * Parse Go coverage profile (coverage.out) format.
 * Format: mode: set|count|atomic
 * Then lines like: github.com/user/pkg/file.go:10.2,12.0 1 5
 * meaning file.go lines 10-12, 1 statement, hit 5 times
 *
 * Lines are expanded for visual decorations, but metrics use
 * statement counts to match `go tool cover` output.
 */
export async function parseGoCover(filePath: string, workspaceRoot: string): Promise<CoverageMap> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const map: CoverageMap = new Map();

  // Read module name from go.mod to strip module prefix from coverage paths
  const moduleName = readModuleName(workspaceRoot);

  // Per-file statement counters for metrics
  const stmtTotals = new Map<string, number>();
  const stmtCovered = new Map<string, number>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('mode:')) continue;

    // format: file:startLine.startCol,endLine.endCol numStatements count
    const match = trimmed.match(/^(.+):(\d+)\.\d+,(\d+)\.\d+\s+(\d+)\s+(\d+)$/);
    if (!match) continue;

    const [, rawFile, startStr, endStr, stmtStr, countStr] = match;
    const startLine = parseInt(startStr, 10);
    const endLine = parseInt(endStr, 10);
    const numStatements = parseInt(stmtStr, 10);
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
      stmtTotals.set(absPath, 0);
      stmtCovered.set(absPath, 0);
    }

    // Expand lines for visual decorations
    for (let l = startLine; l <= endLine; l++) {
      const existing = fc.lines.get(l) ?? 0;
      fc.lines.set(l, existing + count);
    }

    // Accumulate statement counts for metrics (matches `go tool cover`)
    stmtTotals.set(absPath, (stmtTotals.get(absPath) ?? 0) + numStatements);
    if (count > 0) {
      stmtCovered.set(absPath, (stmtCovered.get(absPath) ?? 0) + numStatements);
    }
  }

  // Compute metrics using statement counts
  for (const [absPath, fc] of map) {
    const total = stmtTotals.get(absPath) ?? 0;
    const covered = stmtCovered.get(absPath) ?? 0;
    fc.metrics.totalLines = total;
    fc.metrics.coveredLines = covered;
    fc.metrics.linePercent = total === 0 ? 100
      : Math.round((covered / total) * 100);
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
