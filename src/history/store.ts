import * as fs from 'fs';
import * as path from 'path';
import { CoverageMap, CoverageSnapshot } from '../coverage/types';
import { Logger } from '../util/logger';

const STORE_DIR = '.coverlens';

export function getStorePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, STORE_DIR);
}

export function saveSnapshot(workspaceRoot: string, data: CoverageMap, log: Logger): string {
  const storePath = getStorePath(workspaceRoot);
  if (!fs.existsSync(storePath)) {
    fs.mkdirSync(storePath, { recursive: true });
  }

  const snapshot = createSnapshot(data);
  const filename = `snapshot-${snapshot.timestamp}.json`;
  const filePath = path.join(storePath, filename);

  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  log.info(`Saved coverage snapshot: ${filename}`);
  return filePath;
}

export function loadLatestSnapshot(workspaceRoot: string, log: Logger): CoverageSnapshot | undefined {
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
    return JSON.parse(content) as CoverageSnapshot;
  } catch (error) {
    log.error(`Failed to load snapshot: ${error}`);
    return undefined;
  }
}

function createSnapshot(data: CoverageMap): CoverageSnapshot {
  let totalLines = 0;
  let coveredLines = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  const files: CoverageSnapshot['files'] = {};

  for (const [filePath, fc] of data) {
    totalLines += fc.metrics.totalLines;
    coveredLines += fc.metrics.coveredLines;
    totalBranches += fc.metrics.totalBranches;
    coveredBranches += fc.metrics.coveredBranches;
    files[filePath] = {
      linePercent: fc.metrics.linePercent,
      branchPercent: fc.metrics.branchPercent,
    };
  }

  return {
    timestamp: Date.now(),
    totalLinePercent: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 100,
    totalBranchPercent: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 100,
    files,
  };
}
