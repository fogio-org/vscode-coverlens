import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface MonorepoPackage {
  name: string;
  path: string;
}

export function detectMonorepoPackages(workspaceRoot: string): MonorepoPackage[] {
  const packages: MonorepoPackage[] = [];
  const packageJsonPath = path.join(workspaceRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return packages;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const workspaces: string[] = Array.isArray(packageJson.workspaces)
      ? packageJson.workspaces
      : packageJson.workspaces?.packages ?? [];

    for (const pattern of workspaces) {
      const cleanPattern = pattern.replace(/\/\*$/, '');
      const dir = path.join(workspaceRoot, cleanPattern);
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        for (const entry of fs.readdirSync(dir)) {
          const pkgPath = path.join(dir, entry);
          const pkgJsonPath = path.join(pkgPath, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            try {
              const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
              packages.push({ name: pkgJson.name ?? entry, path: pkgPath });
            } catch {
              packages.push({ name: entry, path: pkgPath });
            }
          }
        }
      }
    }
  } catch {
    // Not a valid package.json or not a monorepo
  }

  return packages;
}

export function getWorkspaceRoots(): string[] {
  return vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? [];
}
