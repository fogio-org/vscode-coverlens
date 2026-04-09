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
import { ensureCoverageInGitignore } from './util/gitignore';
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
  let gitignoreChecked = false;

  // Reflect runner state: spinner in status bar + dim decorations
  runner.onRunningChanged(running => {
    statusBar.setRunning(running);
    decorator.setStale(running);
  });

  // Register tree view
  const treeView = vscode.window.createTreeView('coverlens.tree', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  /** Core reload function — called by watcher and by commands */
  async function reload(): Promise<void> {
    if (!runner.isRunning) statusBar.setLoading();
    try {
      const globs   = cfg().get<string[]>('coverageFiles', ['**/lcov.info']);
      const exclude = cfg().get<string[]>('excludePatterns', ['**/node_modules/**']);

      // Monorepo: collect coverage from all packages
      const monorepoEnabled = cfg().get<boolean>('monorepo.enabled', true);
      let packages: string[] = cfg().get<string[]>('monorepo.packages', []);
      if (monorepoEnabled && !packages.length) {
        packages = await detectPackages(workspaceRoot);
      }
      if (!packages.length) {
        packages = [workspaceRoot];
      }

      const merged: CoverageMap = new Map();
      const allCoverageFiles: string[] = [];
      for (const pkg of packages) {
        try {
          const result = await loadCoverage(globs, exclude, pkg, log);
          for (const [k, v] of result.map) merged.set(k, v);
          allCoverageFiles.push(...result.coverageFiles);
        } catch (err) {
          log.warn(`Failed to load coverage for ${pkg}: ${err}`);
        }
      }

      coverageMap = merged;

      // Check gitignore once per session, after we know which files exist
      if (!gitignoreChecked && allCoverageFiles.length > 0) {
        gitignoreChecked = true;
        ensureCoverageInGitignore(workspaceRoot, allCoverageFiles).catch(() => {});
      }
      decorator.setCoverage(coverageMap);
      treeProvider.setCoverage(coverageMap);

      // Update baseline (sets on first load or branch change)
      await history.updateBaseline(coverageMap);

      const showDelta = cfg().get<boolean>('showDelta', true);

      if (diffMode) {
        await applyDiffFilter();
      } else {
        const delta = showDelta ? history.sessionDelta(coverageMap) : null;
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
    const showDelta = cfg().get<boolean>('showDelta', true);
    try {
      const changed = await getChangedLines(workspaceRoot, base);
      currentDiffLines = changed;
      decorator.setDiffFilter(changed);
      statusBar.setDiffMode(true);
      const delta = showDelta ? history.diffDelta(coverageMap, changed) : null;
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

  /** Run full test suite + reload */
  async function runFullTests(): Promise<void> {
    try {
      runner.abort();
      await runner.run();
    } catch {
      // Tests may fail but still produce coverage
    }
    await reload();
  }

  // Commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand('coverlens.toggle', () => {
      decorator.toggle();
      const showDelta = cfg().get<boolean>('showDelta', true);
      const delta = !showDelta ? null
        : currentDiffLines ? history.diffDelta(coverageMap, currentDiffLines)
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
        const showDelta = cfg().get<boolean>('showDelta', true);
        const delta = showDelta ? history.sessionDelta(coverageMap) : null;
        statusBar.update(coverageMap, decorator.isEnabled, null, delta);
      }
    }),

    vscode.commands.registerCommand('coverlens.refresh', () => reload()),

    vscode.commands.registerCommand('coverlens.runWithCoverage', () => runFullTests()),

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

  // Auto-run tests on save
  let runOnSaveTimeout: ReturnType<typeof setTimeout> | undefined;
  ctx.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const mode = cfg().get<string>('runOnSave', 'package');
      if (mode === 'off' || mode === 'false' || !mode) return;
      const filePath = doc.uri.fsPath;
      if (runOnSaveTimeout) clearTimeout(runOnSaveTimeout);
      runOnSaveTimeout = setTimeout(async () => {
        try {
          runner.abort();
          if (mode === 'all') {
            await runner.run();
          } else {
            await runner.runScoped(filePath);
          }
        } catch (err) {
          log.error(`Test run on save failed: ${err}`);
        }
        await reload();
      }, 1000);
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
    treeProvider,
    { dispose: () => runner.dispose() },
    { dispose: () => watcher.stop() },
    { dispose: () => { if (runOnSaveTimeout) clearTimeout(runOnSaveTimeout); } },
    { dispose: () => log.dispose() }
  );

  // Initial load: enable decorations, run full tests, show coverage
  if (cfg().get<boolean>('enabled', true)) {
    decorator.enable();
    // First try to show existing coverage files
    await reload();
    // Then run full test suite if runOnSave is enabled
    if (cfg().get<boolean>('runOnSave', false)) {
      runFullTests(); // fire-and-forget — don't block activation
    }
  }

  log.info('CoverLens activated.');
}

export function deactivate(): void {}
