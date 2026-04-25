import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { PRESETS, RunnerPreset, detectRunner } from './presets';
import { Logger } from '../util/logger';
import { mergeGoCoverProfiles } from './mergeProfiles';

interface ResolvedRunner {
  runnerKey: string;
  preset: RunnerPreset | null;
  customCmd: string;
}

export class TestRunner {
  private activeProc: cp.ChildProcess | null = null;
  private _running = false;

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
      const resolved = await this.resolveRunner();
      if (resolved.runnerKey === 'custom' && resolved.customCmd) {
        if (!this.assertTrustedForCustomCommand()) return;
        await this.execShell(resolved.customCmd);
        return;
      }
      if (!resolved.preset) return;
      await this.execArgv(resolved.preset.argv);
    } finally {
      this.setRunning(false);
    }
  }

  /** Run tests scoped to the package/directory containing the given file */
  async runScoped(filePath: string): Promise<void> {
    this.setRunning(true);
    try {
      const { runnerKey, preset, customCmd } = await this.resolveRunner();

      if (runnerKey === 'custom' && customCmd) {
        if (!this.assertTrustedForCustomCommand()) return;
        await this.execShell(customCmd);
        return;
      }

      if (!preset) return;

      if (!preset.scoped) {
        await this.execArgv(preset.argv);
        return;
      }

      const relDir = path.relative(this.workspaceRoot, path.dirname(filePath));
      if (!relDir || relDir.startsWith('..')) {
        await this.execArgv(preset.argv);
        return;
      }

      const scoped = preset.scoped(relDir);
      this.log.info(`Scoped run for package: ${relDir}`);
      try {
        await this.execArgv(scoped.argv);
      } catch {
        // Tests may fail but still produce coverage data — continue to merge
      }

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

  private async resolveRunner(): Promise<ResolvedRunner> {
    const cfg = vscode.workspace.getConfiguration('coverlens');
    let runnerKey = cfg.get<string>('testRunner.mode', 'auto');
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

  /** Workspace Trust gate: refuse to execute user-provided shell strings in untrusted workspaces. */
  private assertTrustedForCustomCommand(): boolean {
    if (vscode.workspace.isTrusted) return true;
    this.log.warn('CoverLens: refusing to run testRunner.customCommand in an untrusted workspace.');
    vscode.window.showWarningMessage(
      'CoverLens: custom test commands are disabled in untrusted workspaces. Trust this workspace to enable.'
    );
    return false;
  }

  /** Run a vetted argv array — safe from shell injection because args are passed individually. */
  private execArgv(argv: string[]): Promise<void> {
    const [file, ...args] = argv;
    this.log.info(`Running: ${argv.join(' ')}`);
    return this.spawnAndWait(file, args, { shell: false });
  }

  /** Run a user-provided shell string (gated by Workspace Trust). */
  private execShell(command: string): Promise<void> {
    this.log.info(`Running (shell): ${command}`);
    return this.spawnAndWait(command, [], { shell: true });
  }

  private spawnAndWait(file: string, args: string[], opts: { shell: boolean }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeoutMs = 10 * 60 * 1000;
      const proc = cp.spawn(file, args, {
        cwd: this.workspaceRoot,
        shell: opts.shell,
        windowsHide: true
      });
      this.activeProc = proc;

      let stderrBuf = '';
      const STDERR_LIMIT = 256 * 1024;
      proc.stderr?.on('data', (chunk: Buffer) => {
        if (stderrBuf.length < STDERR_LIMIT) {
          stderrBuf += chunk.toString();
          if (stderrBuf.length > STDERR_LIMIT) stderrBuf = stderrBuf.slice(0, STDERR_LIMIT);
        }
      });
      proc.stdout?.resume();

      const killTimer = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
      }, timeoutMs);

      proc.once('error', (err) => {
        clearTimeout(killTimer);
        if (this.activeProc === proc) this.activeProc = null;
        this.log.error(err.message);
        reject(err);
      });

      proc.once('close', (code, signal) => {
        clearTimeout(killTimer);
        if (this.activeProc === proc) this.activeProc = null;

        if (signal) {
          this.log.info(`Test run terminated by signal ${signal}.`);
          resolve();
          return;
        }
        if (code === 0) {
          this.log.info('Tests completed.');
          resolve();
        } else {
          if (stderrBuf) this.log.error(stderrBuf.trim());
          reject(new Error(`Test process exited with code ${code}`));
        }
      });
    });
  }

  dispose(): void {
    this.abort();
    this._onRunningChanged.dispose();
  }
}
