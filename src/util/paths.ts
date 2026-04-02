import * as path from 'path';
import * as fs from 'fs';

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

  // Try to find the file by traversing up from workspaceRoot
  const candidates = [
    path.resolve(workspaceRoot, normalized),
    path.resolve(workspaceRoot, 'src', normalized),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return normalizePath(c);
  }

  // Fallback: just join with workspace root
  return normalizePath(path.resolve(workspaceRoot, normalized));
}
