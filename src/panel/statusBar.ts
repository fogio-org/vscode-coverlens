import * as vscode from 'vscode';
import { CoverageMap } from '../coverage/types';

export class CoverageStatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'coverlens.toggle';
    this.item.tooltip = 'CoverLens: click to toggle coverage display';
    this.item.show();
    this.setLoading();
  }

  setLoading(): void {
    this.item.text = '$(shield) Coverage…';
    this.item.backgroundColor = undefined;
  }

  setNoCoverage(): void {
    this.item.text = '$(shield) No coverage';
    this.item.backgroundColor = undefined;
  }

  setDiffMode(enabled: boolean): void {
    // Append diff indicator to current text
    const base = this.item.text.replace(' [diff]', '');
    this.item.text = enabled ? `${base} [diff]` : base;
  }

  update(map: CoverageMap, enabled: boolean): void {
    if (map.size === 0) { this.setNoCoverage(); return; }

    const totalLines   = [...map.values()].reduce((s, f) => s + f.metrics.totalLines, 0);
    const coveredLines = [...map.values()].reduce((s, f) => s + f.metrics.coveredLines, 0);
    const pct = totalLines === 0 ? 100 : Math.round((coveredLines / totalLines) * 100);

    const icon = enabled ? '$(shield)' : '$(shield-x)';
    this.item.text = `${icon} ${pct}%`;

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
