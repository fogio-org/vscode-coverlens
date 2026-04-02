import * as path from 'path';

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function resolveFilePath(basePath: string, filePath: string): string {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(basePath, filePath);
  return normalizePath(resolved);
}

export function getRelativePath(basePath: string, filePath: string): string {
  return normalizePath(path.relative(basePath, filePath));
}
