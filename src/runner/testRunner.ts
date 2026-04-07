import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { PRESETS, detectRunner } from './presets';
import { Logger } from '../util/logger';
import { ensureCoverageInGitignore } from '../util/gitignore';

export class TestRunner {
  private gitignoreChecked = false;
  private activeProc: cp.ChildProcess | null = null;
  private _running = false;

  /** Fires when running state changes (true = started, false = finished) */
  private readonly _onRunningChanged = new vscode.EventEmitter<boolean>();
  readonly onRunningChanged = this._onRunningChanged.event;

  get isRunning(): boolean { return this._running; }

  constructor(
    private readonly workspaceRoot: string,
    private readonly log: Logger
  ) {}

  /**
   * Cancel the currently running test process, if any.
   * Sends SIGTERM first, then SIGKILL after 2s if still alive.
   */
  abort(): void {
    if (!this.activeProc || this.activeProc.exitCode !== null) {
      this.activeProc = null;
      return;
    }

    const proc = this.activeProc;
    this.log.info('Aborting previous test run…');
    proc.kill('SIGTERM');

    const forceKill = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
    }, 2000);

    proc.once('exit', () => clearTimeout(forceKill));
    this.activeProc = null;
  }

  /** Run full test suite */
  async run(): Promise<void> {
    const command = await this.resolveCommand();
    if (!command) return;
    await this.execute(command);
  }

  /** Run tests scoped to the package/directory containing the given file */
  async runScoped(filePath: string): Promise<void> {
    const { runnerKey, preset, customCmd } = await this.resolveRunner();

    // Custom command — always full run
    if (runnerKey === 'custom' && customCmd) {
      await this.execute(customCmd);
      return;
    }

    if (!preset) return;

    // If preset has no scoped command, fall back to full run
    if (!preset.scopedCommand) {
      await this.execute(preset.command);
      return;
    }

    // Compute relative directory of the changed file
    const relDir = path.relative(this.workspaceRoot, path.dirname(filePath));
    if (!relDir || relDir.startsWith('..')) {
      // File is outside workspace — full run
      await this.execute(preset.command);
      return;
    }

    const scopedCmd = preset.scopedCommand(relDir);
    this.log.info(`Scoped run for package: ${relDir}`);
    await this.execute(scopedCmd);
  }

  private async resolveRunner(): Promise<{ runnerKey: string; preset: typeof PRESETS[string] | null; customCmd: string }> {
    const cfg = vscode.workspace.getConfiguration('coverlens');
    let runnerKey = cfg.get<string>('testRunner', 'auto');
    const customCmd = cfg.get<string>('testRunner.customCommand', '');

    if (runnerKey === 'auto') {
      runnerKey = await detectRunner(this.workspaceRoot);
      this.log.info(`Auto-detected runner: ${runnerKey}`);
    }

    if (runnerKey === 'custom' && customCmd) {
      return { runnerKey, preset: null, customCmd };
    }

    const preset = PRESETS[runnerKey];
    if (!preset) {
      vscode.window.showErrorMessage(`CoverLens: unknown test runner "${runnerKey}"`);
      return { runnerKey, preset: null, customCmd: '' };
    }

    return { runnerKey, preset, customCmd: '' };
  }

  private async resolveCommand(): Promise<string | null> {
    const { runnerKey, preset, customCmd } = await this.resolveRunner();
    if (runnerKey === 'custom' && customCmd) return customCmd;
    return preset?.command ?? null;
  }

  private async execute(command: string): Promise<void> {
    if (!this.gitignoreChecked) {
      this.gitignoreChecked = true;
      await ensureCoverageInGitignore(this.workspaceRoot);
    }

    this.log.info(`Running: ${command}`);
    this._running = true;
    this._onRunningChanged.fire(true);

    try {
      await this.exec(command);
    } finally {
      this._running = false;
      this._onRunningChanged.fire(false);
    }
  }

  private exec(command: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const proc = cp.exec(command, { cwd: this.workspaceRoot }, (err, stdout, stderr) => {
        if (this.activeProc === proc) this.activeProc = null;

        if (err) {
          if ((err as any).killed || err.message === 'Cancelled') {
            this.log.info('Test run aborted.');
            resolve();
            return;
          }
          this.log.error(stderr || err.message);
          reject(err);
        } else {
          this.log.info('Tests completed.');
          resolve();
        }
      });

      this.activeProc = proc;
    });
  }

  dispose(): void {
    this.abort();
    this._onRunningChanged.dispose();
  }
}
