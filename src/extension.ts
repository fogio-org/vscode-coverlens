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
import { CoverageMap, CoverageSnapshot } from './coverage/types';

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
  const workspaceRoots = getWorkspaceRoots();
  const primaryRoot = workspaceRoots[0] ?? '';

  decorator = new CoverageDecorator(context);
  statusBar = new CoverageStatusBar();
  treeProvider = new CoverageTreeProvider(primaryRoot);
  watcher = new CoverageWatcher();

  const treeView = vscode.window.createTreeView('coverlens.tree', {
    treeDataProvider: treeProvider,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('coverlens.toggle', () => {
      decorator.toggle();
      const enabled = decorator.isEnabled;
      statusBar.update(currentCoverage ?? new Map(), enabled);
      vscode.window.showInformationMessage(
        `CoverLens: Coverage display ${enabled ? 'enabled' : 'disabled'}`,
      );
    }),

    vscode.commands.registerCommand('coverlens.toggleDiff', async () => {
      diffModeActive = !diffModeActive;
      statusBar.setDiffMode(diffModeActive);
      vscode.window.showInformationMessage(
        `CoverLens: Diff mode ${diffModeActive ? 'enabled' : 'disabled'}`,
      );
      await updateDiffFilter();
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
      if (!primaryRoot) return;
      const previous = loadLatestSnapshot(primaryRoot, log);
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
    { dispose: () => watcher.stop() },
    { dispose: () => log.dispose() },
  );

  if (settings.enabled) {
    decorator.enable();
  }

  // Start file watcher and initial load
  if (primaryRoot) {
    watcher.start(
      settings.coverageFiles,
      settings.excludePatterns,
      primaryRoot,
      () => refreshCoverage(),
    );
  }
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

    statusBar.update(currentCoverage, decorator.isEnabled);
    treeProvider.setCoverage(currentCoverage);
    decorator.setCoverage(currentCoverage);
    await updateDiffFilter();
  } else {
    statusBar.setNoCoverage();
  }
}

async function updateDiffFilter(): Promise<void> {
  if (!diffModeActive) {
    decorator.setDiffFilter(null);
    return;
  }

  const settings = getSettings();
  const roots = getWorkspaceRoots();
  if (roots.length === 0) {
    return;
  }

  try {
    const diffMap = await getChangedLines(roots[0], settings.diffBase);
    decorator.setDiffFilter(diffMap);
  } catch (err) {
    log.error(`Failed to get git diff: ${err}`);
    decorator.setDiffFilter(null);
  }
}

export function deactivate(): void {
  log?.info('CoverLens deactivated');
}
