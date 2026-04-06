import * as vscode from 'vscode';
import { CoverageMap } from '../coverage/types';

export class CoverageStatusBar {
  private item: vscode.StatusBarItem;
  private _baseText = '$(shield) Coverage…';
  private _diffMode = false;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'coverlens.toggle';
    this.item.tooltip = 'CoverLens: click to toggle coverage display';
    this.item.show();
    this.setLoading();
  }

  setLoading(): void {
    this._baseText = '$(shield) Coverage…';
    this.refreshText();
    this.item.backgroundColor = undefined;
  }

  setNoCoverage(): void {
    this._baseText = '$(shield) No coverage';
    this.refreshText();
    this.item.backgroundColor = undefined;
  }

  private refreshText(): void {
    this.item.text = this._diffMode ? `${this._baseText} [diff]` : this._baseText;
  }

  setDiffMode(enabled: boolean): void {
    this._diffMode = enabled;
    this.refreshText();
  }

  update(map: CoverageMap, enabled: boolean, diffLines?: Map<string, Set<number>> | null, delta?: number | null): void {
    if (map.size === 0) { this.setNoCoverage(); return; }

    let totalLines = 0;
    let coveredLines = 0;

    if (diffLines) {
      // Diff mode: count only changed lines that have coverage data
      for (const [filePath, fc] of map) {
        const changed = diffLines.get(filePath);
        if (!changed || changed.size === 0) continue;
        for (const [lineNo, hits] of fc.lines) {
          if (!changed.has(lineNo)) continue;
          totalLines++;
          if (hits > 0) coveredLines++;
        }
      }
    } else {
      totalLines   = [...map.values()].reduce((s, f) => s + f.metrics.totalLines, 0);
      coveredLines = [...map.values()].reduce((s, f) => s + f.metrics.coveredLines, 0);
    }

    const pct = totalLines === 0 ? 100 : Math.round((coveredLines / totalLines) * 100);

    const icon = enabled ? '$(shield)' : '$(shield-x)';
    const deltaStr = delta != null ? ` (${delta >= 0 ? '+' : ''}${delta}%)` : '';
    this._baseText = `${icon} ${pct}%${deltaStr}`;
    this.refreshText();

    if (pct < 50) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (pct < 80) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.backgroundColor = undefined;
    }
  }

  dispose(): void { this.item.dispose(); }
}
