import * as fs from 'fs';
import * as path from 'path';
import { CoverageData } from '../coverage/types';
import { log, logError } from '../util/logger';

const STORE_DIR = '.coverlens';

export function getStorePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, STORE_DIR);
}

export function saveSnapshot(workspaceRoot: string, data: CoverageData): string {
  const storePath = getStorePath(workspaceRoot);
  if (!fs.existsSync(storePath)) {
    fs.mkdirSync(storePath, { recursive: true });
  }

  const filename = `snapshot-${data.timestamp}.json`;
  const filePath = path.join(storePath, filename);

  const serializable = {
    ...data,
    files: Object.fromEntries(data.files),
  };

  fs.writeFileSync(filePath, JSON.stringify(serializable, null, 2));
  log(`Saved coverage snapshot: ${filename}`);
  return filePath;
}

export function loadLatestSnapshot(workspaceRoot: string): CoverageData | undefined {
  const storePath = getStorePath(workspaceRoot);
  if (!fs.existsSync(storePath)) {
    return undefined;
  }

  try {
    const files = fs.readdirSync(storePath)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return undefined;
    }

    const content = fs.readFileSync(path.join(storePath, files[0]), 'utf-8');
    const parsed = JSON.parse(content);
    return {
      ...parsed,
      files: new Map(Object.entries(parsed.files)),
    };
  } catch (error) {
    logError('Failed to load snapshot', error);
    return undefined;
  }
}
