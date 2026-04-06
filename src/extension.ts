import * as vscode from 'vscode';
import { loadCoverage } from './coverage/loader';
import { CoverageDecorator } from './decorations/decorator';
import { CoverageTreeProvider } from './panel/coverageTree';
import { CoverageStatusBar } from './panel/statusBar';
import { CoverageWatcher } from './coverage/watcher';
import { TestRunner } from './runner/testRunner';
import { HistoryStore } from './history/store';
import { getChangedLines } from './diffCoverage/gitDiff';
import { detectPackages } from './config/monorepo';
import { Logger } from './util/logger';
import { CoverageMap } from './coverage/types';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const log = new Logger();
  log.info('CoverLens activating…');

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    log.warn('No workspace folder open. CoverLens inactive.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const cfg = () => vscode.workspace.getConfiguration('coverlens');

  const decorator  = new CoverageDecorator(ctx);
  const treeProvider = new CoverageTreeProvider(workspaceRoot);
  const statusBar  = new CoverageStatusBar();
  const history    = new HistoryStore(workspaceRoot);
  const watcher    = new CoverageWatcher();
  const runner     = new TestRunner(workspaceRoot, log);

  let coverageMap: CoverageMap = new Map();
  let diffMode = cfg().get<boolean>('diffMode', false);
  let currentDiffLines: Map<string, Set<number>> | null = null;

  // Register tree view
  const treeView = vscode.window.createTreeView('coverlens.tree', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  /** Core reload function — called by watcher and by commands */
  async function reload(): Promise<void> {
    statusBar.setLoading();
    try {
      const globs   = cfg().get<string[]>('coverageFiles', ['**/lcov.info']);
      const exclude = cfg().get<string[]>('excludePatterns', ['**/node_modules/**']);

      // Monorepo: collect coverage from all packages
      const monorepoEnabled = cfg().get<boolean>('monorepo.enabled', true);
      let packages: string[] = cfg().get<string[]>('monorepo.packages', []);
      if (monorepoEnabled && !packages.length) {
        packages = await detectPackages(workspaceRoot);
      }
      // Fallback: always include workspace root if no packages resolved
      if (!packages.length) {
        packages = [workspaceRoot];
      }

      const merged: CoverageMap = new Map();
      for (const pkg of packages) {
        const partial = await loadCoverage(globs, exclude, pkg, log);
        for (const [k, v] of partial) merged.set(k, v);
      }

      coverageMap = merged;
      decorator.setCoverage(coverageMap);
      treeProvider.setCoverage(coverageMap);

      // Update baseline (sets on first load or branch change)
      await history.updateBaseline(coverageMap);

      if (diffMode) {
        // Reapply diff filter if active
        await applyDiffFilter();
      } else {
        // Normal mode: delta vs session baseline
        const delta = history.sessionDelta(coverageMap);
        statusBar.update(coverageMap, decorator.isEnabled, null, delta);
        if (delta != null) {
          const sign = delta >= 0 ? '+' : '';
          log.info(`Coverage delta vs session start: ${sign}${delta}%`);
        }
      }

    } catch (err) {
      log.error(`Reload failed: ${err}`);
      statusBar.setNoCoverage();
    }
  }

  async function applyDiffFilter(): Promise<void> {
    const base = cfg().get<string>('diffBase', 'HEAD');
    try {
      const changed = await getChangedLines(workspaceRoot, base);
      currentDiffLines = changed;
      decorator.setDiffFilter(changed);
      statusBar.setDiffMode(true);
      // Diff delta: how your changes affect overall coverage
      const delta = history.diffDelta(coverageMap, changed);
      statusBar.update(coverageMap, decorator.isEnabled, changed, delta);
      if (delta != null) {
        const sign = delta >= 0 ? '+' : '';
        log.info(`Coverage impact of changes: ${sign}${delta}%`);
      }
    } catch (err) {
      log.warn(`git diff failed (not a git repo?): ${err}`);
      currentDiffLines = null;
      decorator.setDiffFilter(null);
      statusBar.setDiffMode(false);
      statusBar.update(coverageMap, decorator.isEnabled);
      diffMode = false;
    }
  }

  // Commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand('coverlens.toggle', () => {
      decorator.toggle();
      const delta = currentDiffLines
        ? history.diffDelta(coverageMap, currentDiffLines)
        : history.sessionDelta(coverageMap);
      statusBar.update(coverageMap, decorator.isEnabled, currentDiffLines, delta);
    }),

    vscode.commands.registerCommand('coverlens.toggleDiff', async () => {
      diffMode = !diffMode;
      if (diffMode) {
        await applyDiffFilter();
      } else {
        currentDiffLines = null;
        decorator.setDiffFilter(null);
        statusBar.setDiffMode(false);
        const delta = history.sessionDelta(coverageMap);
        statusBar.update(coverageMap, decorator.isEnabled, null, delta);
      }
    }),

    vscode.commands.registerCommand('coverlens.refresh', () => reload()),

    vscode.commands.registerCommand('coverlens.runWithCoverage', async () => {
      await runner.run();
      await reload();
    }),

    vscode.commands.registerCommand('coverlens.showHistory', () => {
      if (coverageMap.size === 0) {
        vscode.window.showInformationMessage('CoverLens: no coverage data loaded.');
        return;
      }
      const delta = currentDiffLines
        ? history.diffDelta(coverageMap, currentDiffLines)
        : history.sessionDelta(coverageMap);
      const totalLines   = [...coverageMap.values()].reduce((s, f) => s + f.metrics.totalLines, 0);
      const coveredLines = [...coverageMap.values()].reduce((s, f) => s + f.metrics.coveredLines, 0);
      const pct = totalLines === 0 ? 100 : Math.round((coveredLines / totalLines) * 100);
      const deltaStr = delta != null
        ? ` (${delta >= 0 ? '+' : ''}${delta}% vs ${currentDiffLines ? 'base' : 'session start'})`
        : '';
      vscode.window.showInformationMessage(`CoverLens: ${pct}% coverage${deltaStr}`);
    }),

    vscode.commands.registerCommand('coverlens.clearHistory', () => {
      history.resetBaseline();
      vscode.window.showInformationMessage('CoverLens: baseline reset.');
    })
  );

  // Reload coverage when relevant settings change
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (
        e.affectsConfiguration('coverlens.coverageFiles') ||
        e.affectsConfiguration('coverlens.excludePatterns') ||
        e.affectsConfiguration('coverlens.monorepo')
      ) {
        reload();
      }
    })
  );

  // Auto-run tests on save (if enabled)
  let runOnSaveTimeout: ReturnType<typeof setTimeout> | undefined;
  ctx.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
      if (!cfg().get<boolean>('runOnSave', false)) return;
      // Debounce: wait 500ms after last save to avoid multiple runs
      if (runOnSaveTimeout) clearTimeout(runOnSaveTimeout);
      runOnSaveTimeout = setTimeout(async () => {
        await runner.run();
        await reload();
      }, 500);
    })
  );

  // File watcher
  const globs   = cfg().get<string[]>('coverageFiles', ['**/lcov.info']);
  const exclude = cfg().get<string[]>('excludePatterns', ['**/node_modules/**']);
  await watcher.start(globs, exclude, workspaceRoot, reload);

  // Register disposables
  ctx.subscriptions.push(
    decorator,
    statusBar,
    treeView,
    { dispose: () => watcher.stop() },
    { dispose: () => log.dispose() }
  );

  // Initial load
  if (cfg().get<boolean>('enabled', true)) {
    decorator.enable();
    await reload();
  }

  log.info('CoverLens activated.');
}

export function deactivate(): void {}
