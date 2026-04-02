import * as fs from 'fs';
import * as path from 'path';
import * as fg from 'fast-glob';

/** Detect monorepo package roots */
export async function detectPackages(workspaceRoot: string): Promise<string[]> {
  // pnpm-workspace.yaml
  const pnpmWs = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWs)) {
    const content = fs.readFileSync(pnpmWs, 'utf8');
    const patterns = content.match(/- ['"]?([^'"]+)['"]?/g)
      ?.map(m => m.replace(/^- ['"]?|['"]?$/g, '').trim()) ?? [];
    return resolvePatterns(patterns, workspaceRoot);
  }

  // package.json workspaces
  const pkgJson = path.join(workspaceRoot, 'package.json');
  if (fs.existsSync(pkgJson)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    const patterns: string[] = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : pkg.workspaces?.packages ?? [];
    if (patterns.length) return resolvePatterns(patterns, workspaceRoot);
  }

  return [workspaceRoot]; // single-package fallback
}

async function resolvePatterns(patterns: string[], root: string): Promise<string[]> {
  const results: string[] = [];
  for (const pattern of patterns) {
    const matches = await fg.glob(pattern, { cwd: root, absolute: true, onlyDirectories: true });
    results.push(...matches);
  }
  return results.length ? results : [root];
}
