import * as vscode from 'vscode';
import * as path from 'path';
import { FileCoverage } from '../coverage/types';

export class CoverageTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly coverage?: FileCoverage,
    public readonly resourceUri?: vscode.Uri,
  ) {
    super(label, collapsibleState);
    if (coverage) {
      const pct = Math.round(coverage.lineRate * 100);
      this.description = `${pct}%`;
      this.tooltip = `Line coverage: ${pct}%`;
    }
  }
}

export class CoverageTreeProvider implements vscode.TreeDataProvider<CoverageTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CoverageTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private coverageData: Map<string, FileCoverage> = new Map();

  update(data: Map<string, FileCoverage>): void {
    this.coverageData = data;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: CoverageTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CoverageTreeItem): CoverageTreeItem[] {
    if (element) {
      return [];
    }

    const items: CoverageTreeItem[] = [];
    for (const [filePath, coverage] of this.coverageData) {
      const label = path.basename(filePath);
      const item = new CoverageTreeItem(
        label,
        vscode.TreeItemCollapsibleState.None,
        coverage,
        vscode.Uri.file(filePath),
      );
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(filePath)],
      };
      items.push(item);
    }

    return items.sort((a, b) => a.label.localeCompare(b.label));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
