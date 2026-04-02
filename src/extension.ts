import * as vscode from 'vscode';
import { CoverageDecorator } from './decorations/decorator';
import { CoverageStatusBar } from './panel/statusBar';
import { CoverageTreeProvider } from './panel/coverageTree';
import { CoverageWatcher } from './coverage/watcher';
import { loadCoverageFile } from './coverage/loader';
import { aggregateCoverage } from './coverage/aggregator';
import { getSettings } from './config/settings';
import { getWorkspaceRoots } from './config/monorepo';
import { log } from './util/logger';
import { CoverageData } from './coverage/types';
import * as fg from 'fast-glob';
import * as path from 'path';

let decorator: CoverageDecorator;
let statusBar: CoverageStatusBar;
let treeProvider: CoverageTreeProvider;
let watcher: CoverageWatcher;
let currentCoverage: CoverageData | undefined;

export function activate(context: vscode.ExtensionContext): void {
  log('CoverLens activating...');

  decorator = new CoverageDecorator();
  statusBar = new CoverageStatusBar();
  treeProvider = new CoverageTreeProvider();

  const treeView = vscode.window.createTreeView('coverlens.coverageTree', {
    treeDataProvider: treeProvider,
  });

  watcher = new CoverageWatcher(async () => {
    await refreshCoverage();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('coverlens.toggleCoverage', () => {
      const enabled = decorator.toggle();
      vscode.window.showInformationMessage(
        `CoverLens: Coverage display ${enabled ? 'enabled' : 'disabled'}`,
      );
      if (enabled && currentCoverage) {
        applyDecorations();
      }
    }),

    vscode.commands.registerCommand('coverlens.loadCoverage', async () => {
      await refreshCoverage();
      vscode.window.showInformationMessage('CoverLens: Coverage loaded');
    }),

    vscode.window.onDidChangeActiveTextEditor(() => {
      if (currentCoverage) {
        applyDecorations();
      }
    }),

    treeView,
    { dispose: () => decorator.dispose() },
    { dispose: () => statusBar.dispose() },
    { dispose: () => treeProvider.dispose() },
    { dispose: () => watcher.dispose() },
  );

  // Auto-load coverage on activation
  const settings = getSettings();
  if (settings.autoWatch) {
    setupWatcher(settings.coveragePaths);
  }
  refreshCoverage();

  log('CoverLens activated');
}

async function refreshCoverage(): Promise<void> {
  const settings = getSettings();
  const workspaceRoots = getWorkspaceRoots();

  if (workspaceRoots.length === 0) {
    return;
  }

  const datasets: CoverageData[] = [];

  for (const root of workspaceRoots) {
    for (const pattern of settings.coveragePaths) {
      const matches = await fg.default(pattern, { cwd: root, absolute: true });
      for (const match of matches) {
        const data = await loadCoverageFile(match, root);
        if (data) {
          datasets.push(data);
        }
      }
    }
  }

  if (datasets.length > 0) {
    currentCoverage = aggregateCoverage(datasets);
    statusBar.update(currentCoverage.files);
    treeProvider.update(currentCoverage.files);
    applyDecorations();
  } else {
    statusBar.update(new Map());
  }
}

function applyDecorations(): void {
  if (!currentCoverage) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const coverage = currentCoverage.files.get(filePath);
  if (coverage) {
    decorator.apply(editor, coverage);
  }
}

function setupWatcher(patterns: string[]): void {
  const roots = getWorkspaceRoots();
  const watchPatterns: string[] = [];

  for (const root of roots) {
    for (const pattern of patterns) {
      watchPatterns.push(path.join(root, pattern));
    }
  }

  if (watchPatterns.length > 0) {
    watcher.watch(watchPatterns);
  }
}

export function deactivate(): void {
  log('CoverLens deactivated');
}
