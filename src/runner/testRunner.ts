import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { PRESETS, RunnerPreset, detectRunner } from './presets';
import { Logger } from '../util/logger';
import { mergeGoCoverProfiles } from './mergeProfiles';

export class TestRunner {
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

  abort(): void {
    if (!this.activeProc || this.activeProc.exitCode !== null) {
      this.activeProc = null;
      this.setRunning(false);
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
    this.setRunning(false);
  }

  /** Run full test suite */
  async run(): Promise<void> {
    this.setRunning(true);
    try {
      const command = this.resolveCommand();
      if (!command) return;
      await this.execute(command);
    } finally {
      this.setRunning(false);
    }
  }

  /** Run tests scoped to the package/directory containing the given file */
  async runScoped(filePath: string): Promise<void> {
    this.setRunning(true);
    try {
      const { runnerKey, preset, customCmd } = this.resolveRunner();

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
        await this.execute(preset.command);
        return;
      }

      const scopedCmd = preset.scopedCommand(relDir);
      this.log.info(`Scoped run for package: ${relDir}`);
      try {
        await this.execute(scopedCmd);
      } catch {
        // Tests may fail but still produce coverage data — continue to merge
      }

      // Merge partial coverage into main file if needed
      if (preset.scopedOutput) {
        await this.mergeScoped(preset);
      }
    } finally {
      this.setRunning(false);
    }
  }

  private setRunning(running: boolean): void {
    if (this._running === running) return;
    this._running = running;
    this._onRunningChanged.fire(running);
  }

  private async mergeScoped(preset: RunnerPreset): Promise<void> {
    if (!preset.scopedOutput) return;
    try {
      await mergeGoCoverProfiles(
        this.workspaceRoot,
        preset.outputGlob,
        preset.scopedOutput
      );
      this.log.info('Merged scoped coverage into main profile.');
    } catch (err) {
      this.log.error(`Failed to merge coverage profiles: ${err}`);
    }
  }

  private resolveRunner(): { runnerKey: string; preset: RunnerPreset | null; customCmd: string } {
    const cfg = vscode.workspace.getConfiguration('coverlens');
    let runnerKey = cfg.get<string>('testRunner.mode', 'auto');
    const customCmd = cfg.get<string>('testRunner.customCommand', '');

    if (runnerKey === 'auto') {
      runnerKey = detectRunner(this.workspaceRoot);
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

  private resolveCommand(): string | null {
    const { runnerKey, preset, customCmd } = this.resolveRunner();
    if (runnerKey === 'custom' && customCmd) return customCmd;
    return preset?.command ?? null;
  }

  private async execute(command: string): Promise<void> {
    this.log.info(`Running: ${command}`);
    await this.exec(command);
  }

  private exec(command: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = 10 * 60 * 1000; // 10 minutes
      const proc = cp.exec(command, { cwd: this.workspaceRoot, maxBuffer: 50 * 1024 * 1024, timeout }, (err, stdout, stderr) => {
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
