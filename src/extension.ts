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
  const history    = new HistoryStore(ctx.globalStorageUri.fsPath, workspaceRoot);
  const watcher    = new CoverageWatcher();
  const runner     = new TestRunner(workspaceRoot, log);

  let coverageMap: CoverageMap = new Map();
  let diffMode = cfg().get<boolean>('diffMode', false);

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
      statusBar.update(coverageMap, decorator.isEnabled);

      if (cfg().get<boolean>('history.enabled', true)) {
        history.save(coverageMap);
        const delta = history.delta();
        if (delta) {
          const sign = (n: number) => n >= 0 ? '+' : '';
          log.info(`Coverage delta: lines ${sign(delta.linePercent)}${delta.linePercent}%, branches ${sign(delta.branchPercent)}${delta.branchPercent}%`);
        }
      }

      // Reapply diff filter if active
      if (diffMode) await applyDiffFilter();

    } catch (err) {
      log.error(`Reload failed: ${err}`);
      statusBar.setNoCoverage();
    }
  }

  async function applyDiffFilter(): Promise<void> {
    const base = cfg().get<string>('diffBase', 'HEAD');
    try {
      const changed = await getChangedLines(workspaceRoot, base);
      decorator.setDiffFilter(changed);
      statusBar.setDiffMode(true);
    } catch (err) {
      log.warn(`git diff failed (not a git repo?): ${err}`);
      decorator.setDiffFilter(null);
    }
  }

  // Commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand('coverlens.toggle', () => {
      decorator.toggle();
      statusBar.update(coverageMap, decorator.isEnabled);
    }),

    vscode.commands.registerCommand('coverlens.toggleDiff', async () => {
      diffMode = !diffMode;
      if (diffMode) {
        await applyDiffFilter();
      } else {
        decorator.setDiffFilter(null);
        statusBar.setDiffMode(false);
      }
    }),

    vscode.commands.registerCommand('coverlens.refresh', () => reload()),

    vscode.commands.registerCommand('coverlens.runWithCoverage', async () => {
      await runner.run();
      await reload();
    }),

    vscode.commands.registerCommand('coverlens.showHistory', () => {
      const snaps = history.load();
      if (!snaps.length) {
        vscode.window.showInformationMessage('CoverLens: no history yet. Run tests first.');
        return;
      }
      const latest = snaps[snaps.length - 1];
      const delta = history.delta();
      const deltaStr = delta
        ? ` (${delta.linePercent >= 0 ? '+' : ''}${delta.linePercent}% vs previous)`
        : '';
      vscode.window.showInformationMessage(
        `CoverLens history: ${snaps.length} snapshots. Latest: ${latest.totalLinePercent}%${deltaStr}`
      );
    }),

    vscode.commands.registerCommand('coverlens.clearHistory', async () => {
      const answer = await vscode.window.showWarningMessage(
        'CoverLens: Delete all coverage history snapshots?',
        { modal: true },
        'Delete'
      );
      if (answer === 'Delete') {
        const historyDir = ctx.globalStorageUri.fsPath;
        require('fs').rmSync(historyDir, { recursive: true, force: true });
        vscode.window.showInformationMessage('CoverLens: history cleared.');
      }
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
