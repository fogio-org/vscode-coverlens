import * as fs from 'fs';
import * as path from 'path';
import { CoverageMap, CoverageSnapshot } from '../coverage/types';

export class HistoryStore {
  private dir: string;

  constructor(workspaceRoot: string) {
    this.dir = path.join(workspaceRoot, '.coverlens');
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
  }

  save(map: CoverageMap): void {
    const totalLines   = [...map.values()].reduce((s, f) => s + f.metrics.totalLines, 0);
    const coveredLines = [...map.values()].reduce((s, f) => s + f.metrics.coveredLines, 0);
    const totalBranches   = [...map.values()].reduce((s, f) => s + f.metrics.totalBranches, 0);
    const coveredBranches = [...map.values()].reduce((s, f) => s + f.metrics.coveredBranches, 0);

    const snap: CoverageSnapshot = {
      timestamp: Date.now(),
      totalLinePercent:   totalLines   === 0 ? 100 : Math.round(coveredLines   / totalLines   * 100),
      totalBranchPercent: totalBranches === 0 ? 100 : Math.round(coveredBranches / totalBranches * 100),
      files: {}
    };

    for (const [p, fc] of map) {
      snap.files[p] = {
        linePercent:   fc.metrics.linePercent,
        branchPercent: fc.metrics.branchPercent
      };
    }

    const file = path.join(this.dir, `snap_${snap.timestamp}.json`);
    fs.writeFileSync(file, JSON.stringify(snap));
    this.prune();
  }

  load(): CoverageSnapshot[] {
    if (!fs.existsSync(this.dir)) return [];
    const files = fs.readdirSync(this.dir)
      .filter(f => f.startsWith('snap_') && f.endsWith('.json'))
      .sort();
    return files.map(f => JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8')));
  }

  delta(): { linePercent: number; branchPercent: number } | null {
    const snaps = this.load();
    if (snaps.length < 2) return null;
    const prev = snaps[snaps.length - 2];
    const curr = snaps[snaps.length - 1];
    return {
      linePercent:   curr.totalLinePercent   - prev.totalLinePercent,
      branchPercent: curr.totalBranchPercent - prev.totalBranchPercent
    };
  }

  private prune(): void {
    const vscode = require('vscode');
    const cfg = vscode.workspace.getConfiguration('coverlens');
    const max: number = cfg.get('history.maxSnapshots', 50);
    const files = fs.readdirSync(this.dir)
      .filter(f => f.startsWith('snap_') && f.endsWith('.json'))
      .sort();
    while (files.length > max) {
      fs.unlinkSync(path.join(this.dir, files.shift()!));
    }
  }
}
