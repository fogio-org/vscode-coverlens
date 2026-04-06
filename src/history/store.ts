import * as cp from 'child_process';
import { CoverageMap } from '../coverage/types';

export class HistoryStore {
  /** Coverage % captured at session start (or after branch change) */
  private baselinePercent: number | null = null;
  /** Git branch at the time baseline was set */
  private baselineBranch: string | null = null;

  constructor(private readonly workspaceRoot: string) {}

  /**
   * Compute the total line coverage percentage for a map.
   */
  private static totalPercent(map: CoverageMap): number {
    const totalLines   = [...map.values()].reduce((s, f) => s + f.metrics.totalLines, 0);
    const coveredLines = [...map.values()].reduce((s, f) => s + f.metrics.coveredLines, 0);
    return totalLines === 0 ? 100 : Math.round((coveredLines / totalLines) * 100);
  }

  /**
   * Called on every reload. Sets baseline on first call or when branch changes.
   */
  async updateBaseline(map: CoverageMap): Promise<void> {
    const branch = await getCurrentBranch(this.workspaceRoot);
    const pct = HistoryStore.totalPercent(map);

    if (this.baselinePercent === null || branch !== this.baselineBranch) {
      this.baselinePercent = pct;
      this.baselineBranch = branch;
    }
  }

  /**
   * Normal mode delta: current coverage vs session baseline.
   */
  sessionDelta(map: CoverageMap): number | null {
    if (this.baselinePercent === null) return null;
    const current = HistoryStore.totalPercent(map);
    const delta = current - this.baselinePercent;
    return delta === 0 ? null : delta;
  }

  /**
   * Diff mode delta: how changed lines affect overall project coverage.
   * Compares total coverage (all lines) vs coverage of unchanged lines only.
   * Positive = your changes improved coverage, negative = reduced it.
   */
  diffDelta(map: CoverageMap, diffLines: Map<string, Set<number>>): number | null {
    let allTotal = 0, allCovered = 0;
    let unchangedTotal = 0, unchangedCovered = 0;

    for (const [filePath, fc] of map) {
      const changed = diffLines.get(filePath);

      for (const [lineNo, hits] of fc.lines) {
        allTotal++;
        if (hits > 0) allCovered++;

        const isChanged = changed?.has(lineNo) ?? false;
        if (!isChanged) {
          unchangedTotal++;
          if (hits > 0) unchangedCovered++;
        }
      }
    }

    const currentPct   = allTotal === 0 ? 100 : Math.round((allCovered / allTotal) * 100);
    const unchangedPct = unchangedTotal === 0 ? 100 : Math.round((unchangedCovered / unchangedTotal) * 100);
    const delta = currentPct - unchangedPct;

    return delta === 0 ? null : delta;
  }

  /**
   * Force-reset the baseline (e.g. user command).
   */
  resetBaseline(): void {
    this.baselinePercent = null;
    this.baselineBranch = null;
  }
}

function getCurrentBranch(workspaceRoot: string): Promise<string | null> {
  return new Promise(resolve => {
    cp.execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspaceRoot }, (err, stdout) => {
      if (err) { resolve(null); return; }
      resolve(stdout.trim() || null);
    });
  });
}
