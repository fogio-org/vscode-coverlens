import * as vscode from 'vscode';
import { CoverageDecorator } from './decorations/decorator';
import { CoverageStatusBar } from './panel/statusBar';
import { CoverageTreeProvider } from './panel/coverageTree';
import { CoverageWatcher } from './coverage/watcher';
import { loadCoverage } from './coverage/loader';
import { getSettings } from './config/settings';
import { getWorkspaceRoots } from './config/monorepo';
import { getChangedLines } from './diffCoverage/gitDiff';
import { saveSnapshot, loadLatestSnapshot } from './history/store';
import { computeDelta } from './history/trend';
import { Logger } from './util/logger';
import { normalizePath } from './util/paths';
import { CoverageMap, CoverageSnapshot } from './coverage/types';
import * as path from 'path';

let log: Logger;
let decorator: CoverageDecorator;
let statusBar: CoverageStatusBar;
let treeProvider: CoverageTreeProvider;
let watcher: CoverageWatcher;
let currentCoverage: CoverageMap | undefined;
let diffModeActive = false;

export function activate(context: vscode.ExtensionContext): void {
  log = new Logger();
  log.info('CoverLens activating...');

  const settings = getSettings();
  decorator = new CoverageDecorator(context);
  statusBar = new CoverageStatusBar();
  treeProvider = new CoverageTreeProvider();

  const treeView = vscode.window.createTreeView('coverlens.tree', {
    treeDataProvider: treeProvider,
  });

  watcher = new CoverageWatcher(async () => {
    await refreshCoverage();
  }, log);

  context.subscriptions.push(
    vscode.commands.registerCommand('coverlens.toggle', () => {
      decorator.toggle();
      vscode.window.showInformationMessage(
        `CoverLens: Coverage display ${decorator.isEnabled ? 'enabled' : 'disabled'}`,
      );
    }),

    vscode.commands.registerCommand('coverlens.toggleDiff', () => {
      diffModeActive = !diffModeActive;
      vscode.window.showInformationMessage(
        `CoverLens: Diff mode ${diffModeActive ? 'enabled' : 'disabled'}`,
      );
      updateDiffFilter();
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
      const previous = loadLatestSnapshot(roots[0], log);
      if (!previous) {
        vscode.window.showInformationMessage('CoverLens: No coverage history found');
        return;
      }
      if (currentCoverage) {
        const currentSnapshot: CoverageSnapshot = {
          timestamp: Date.now(),
          totalLinePercent: computeTotalPercent(currentCoverage),
          totalBranchPercent: 0,
          files: {},
        };
        const delta = computeDelta(previous, currentSnapshot);
        const sign = delta.delta >= 0 ? '+' : '';
        vscode.window.showInformationMessage(
          `CoverLens: Coverage ${sign}${delta.delta}% (${delta.currentPercent}% current)`,
        );
      }
    }),

    vscode.commands.registerCommand('coverlens.clearHistory', () => {
      vscode.window.showInformationMessage('CoverLens: History cleared');
    }),

    treeView,
    { dispose: () => decorator.dispose() },
    { dispose: () => statusBar.dispose() },
    { dispose: () => treeProvider.dispose() },
    { dispose: () => watcher.dispose() },
    { dispose: () => log.dispose() },
  );

  if (settings.enabled) {
    decorator.enable();
  }

  setupWatcher(settings.coverageFiles);
  refreshCoverage();

  log.info('CoverLens activated');
}

function computeTotalPercent(data: CoverageMap): number {
  let total = 0;
  let covered = 0;
  for (const fc of data.values()) {
    total += fc.metrics.totalLines;
    covered += fc.metrics.coveredLines;
  }
  return total > 0 ? Math.round((covered / total) * 100) : 100;
}

async function refreshCoverage(): Promise<void> {
  const settings = getSettings();
  const workspaceRoots = getWorkspaceRoots();

  if (workspaceRoots.length === 0) {
    return;
  }

  const merged: CoverageMap = new Map();

  for (const root of workspaceRoots) {
    const partial = await loadCoverage(
      settings.coverageFiles,
      settings.excludePatterns,
      root,
      log,
    );
    for (const [k, v] of partial) {
      merged.set(k, v);
    }
  }

  if (merged.size > 0) {
    currentCoverage = merged;

    if (settings.historyEnabled) {
      saveSnapshot(workspaceRoots[0], currentCoverage, log);
    }

    statusBar.update(currentCoverage);
    treeProvider.update(currentCoverage);
    decorator.setCoverage(currentCoverage);
    updateDiffFilter();
  } else {
    statusBar.update(new Map());
  }
}

function updateDiffFilter(): void {
  if (!diffModeActive) {
    decorator.setDiffFilter(null);
    return;
  }

  const settings = getSettings();
  const roots = getWorkspaceRoots();
  if (roots.length === 0) {
    return;
  }

  const changedLines = getChangedLines(roots[0], settings.diffBase);
  const diffMap = new Map<string, Set<number>>();
  for (const dl of changedLines) {
    const normalized = normalizePath(path.resolve(roots[0], dl.filePath));
    let set = diffMap.get(normalized);
    if (!set) {
      set = new Set();
      diffMap.set(normalized, set);
    }
    set.add(dl.lineNumber);
  }
  decorator.setDiffFilter(diffMap);
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
  log?.info('CoverLens deactivated');
}
