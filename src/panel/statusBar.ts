import * as vscode from 'vscode';
import { FileCoverage } from '../coverage/types';

export class CoverageStatusBar {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.statusBarItem.command = 'coverlens.toggleCoverage';
    this.statusBarItem.tooltip = 'Click to toggle coverage display';
  }

  update(files: Map<string, FileCoverage>): void {
    if (files.size === 0) {
      this.statusBarItem.text = '$(shield) CoverLens: No data';
      this.statusBarItem.show();
      return;
    }

    let totalLines = 0;
    let coveredLines = 0;

    for (const coverage of files.values()) {
      totalLines += coverage.lines.length;
      coveredLines += coverage.lines.filter(l => l.executionCount > 0).length;
    }

    const pct = totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
    this.statusBarItem.text = `$(shield) CoverLens: ${pct}%`;
    this.statusBarItem.show();
  }

  show(): void {
    this.statusBarItem.show();
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
