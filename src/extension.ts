import * as vscode from 'vscode';
import { CoverageDecorator } from './decorations/decorator';
import { CoverageStatusBar } from './panel/statusBar';
import { CoverageTreeProvider } from './panel/coverageTree';
import { CoverageWatcher } from './coverage/watcher';
import { loadCoverageFile } from './coverage/loader';
import { aggregateCoverage } from './coverage/aggregator';
import { getSettings } from './config/settings';
import { getWorkspaceRoots } from './config/monorepo';
import { getChangedLines } from './diffCoverage/gitDiff';
import { filterCoverageToDiff } from './diffCoverage/filter';
import { saveSnapshot, loadLatestSnapshot } from './history/store';
import { computeDelta } from './history/trend';
import { log } from './util/logger';
import { CoverageData, FileCoverage } from './coverage/types';
import * as fg from 'fast-glob';
import * as path from 'path';

let decorator: CoverageDecorator;
let statusBar: CoverageStatusBar;
let treeProvider: CoverageTreeProvider;
let watcher: CoverageWatcher;
let currentCoverage: CoverageData | undefined;
let diffModeActive = false;

export function activate(context: vscode.ExtensionContext): void {
  log('CoverLens activating...');

  const settings = getSettings();
  decorator = new CoverageDecorator();
  statusBar = new CoverageStatusBar();
  treeProvider = new CoverageTreeProvider();

  const treeView = vscode.window.createTreeView('coverlens.tree', {
    treeDataProvider: treeProvider,
  });

  watcher = new CoverageWatcher(async () => {
    await refreshCoverage();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('coverlens.toggle', () => {
      const enabled = decorator.toggle();
      vscode.window.showInformationMessage(
        `CoverLens: Coverage display ${enabled ? 'enabled' : 'disabled'}`,
      );
      if (enabled && currentCoverage) {
        applyDecorations();
      }
    }),

    vscode.commands.registerCommand('coverlens.toggleDiff', () => {
      diffModeActive = !diffModeActive;
      vscode.window.showInformationMessage(
        `CoverLens: Diff mode ${diffModeActive ? 'enabled' : 'disabled'}`,
      );
      if (currentCoverage) {
        applyDecorations();
      }
    }),

    vscode.commands.registerCommand('coverlens.runWithCoverage', async () => {
      vscode.window.showInformationMessage('CoverLens: Running tests with coverage...');
      // Test runner integration will be expanded in a future prompt
    }),

    vscode.commands.registerCommand('coverlens.refresh', async () => {
      await refreshCoverage();
      vscode.window.showInformationMessage('CoverLens: Coverage reloaded');
    }),

    vscode.commands.registerCommand('coverlens.showHistory', () => {
      const roots = getWorkspaceRoots();
      if (roots.length === 0) {
        return;
      }
      const previous = loadLatestSnapshot(roots[0]);
      if (!previous) {
        vscode.window.showInformationMessage('CoverLens: No coverage history found');
        return;
      }
      if (currentCoverage) {
        const delta = computeDelta(previous, currentCoverage);
        const sign = delta.delta >= 0 ? '+' : '';
        vscode.window.showInformationMessage(
          `CoverLens: Coverage ${sign}${(delta.delta * 100).toFixed(1)}% (${(delta.currentRate * 100).toFixed(1)}% current)`,
        );
      }
    }),

    vscode.commands.registerCommand('coverlens.clearHistory', () => {
      vscode.window.showInformationMessage('CoverLens: History cleared');
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

  if (settings.enabled) {
    decorator.toggle(); // enable decorations
  }

  setupWatcher(settings.coverageFiles);
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
    for (const pattern of settings.coverageFiles) {
      const matches = await fg.default(pattern, {
        cwd: root,
        absolute: true,
        ignore: settings.excludePatterns,
      });
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

    if (settings.historyEnabled) {
      saveSnapshot(workspaceRoots[0], currentCoverage);
    }

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

  let files = currentCoverage.files;

  if (diffModeActive) {
    const settings = getSettings();
    const roots = getWorkspaceRoots();
    if (roots.length > 0) {
      const changedLines = getChangedLines(roots[0], settings.diffBase);
      files = filterCoverageToDiff(files, changedLines);
    }
  }

  const filePath = editor.document.uri.fsPath;
  const coverage = files.get(filePath);
  if (coverage) {
    decorator.apply(editor, coverage);
  } else {
    decorator.clearAll();
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
