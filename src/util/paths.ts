import * as path from 'path';
import * as fs from 'fs';
import * as fg from 'fast-glob';

/** Normalize path separators to forward slashes */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Given a path from a coverage file (may be relative or absolute),
 * resolve it against the workspace root and return a normalized absolute path.
 */
export function resolveFilePath(coveragePath: string, workspaceRoot: string): string {
  const normalized = normalizePath(coveragePath);
  if (path.isAbsolute(normalized)) return normalized;

  // Try direct join and common source directories
  const candidates = [
    path.resolve(workspaceRoot, normalized),
    path.resolve(workspaceRoot, 'src', normalized),
    path.resolve(workspaceRoot, 'lib', normalized),
    path.resolve(workspaceRoot, 'source', normalized),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return normalizePath(c);
  }

  // If the full relative path didn't match, try finding just the filename
  // anywhere in the workspace (handles JaCoCo-style "com/example/Foo.java"
  // when the file is at a different location).
  const basename = path.basename(normalized);
  const found = fg.globSync(`**/${basename}`, {
    cwd: workspaceRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/vendor/**', '**/.git/**'],
    onlyFiles: true,
    deep: 10,
  });

  if (found.length === 1) {
    return normalizePath(found[0]);
  }

  // If multiple matches, prefer one whose relative path ends with the coverage path
  if (found.length > 1) {
    const best = found.find(f => normalizePath(f).endsWith(normalized));
    if (best) return normalizePath(best);
    // Otherwise return first match
    return normalizePath(found[0]);
  }

  // Fallback: just join with workspace root
  return normalizePath(path.resolve(workspaceRoot, normalized));
}
