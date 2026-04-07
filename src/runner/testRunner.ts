import * as vscode from 'vscode';
import * as cp from 'child_process';
import { PRESETS, detectRunner } from './presets';
import { Logger } from '../util/logger';
import { ensureCoverageInGitignore } from '../util/gitignore';

export class TestRunner {
  private gitignoreChecked = false;
  private activeProc: cp.ChildProcess | null = null;

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

    // Force-kill after 2 seconds if process didn't exit
    const forceKill = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
    }, 2000);

    proc.once('exit', () => clearTimeout(forceKill));
    this.activeProc = null;
  }

  async run(): Promise<void> {
    // On first run, check .gitignore
    if (!this.gitignoreChecked) {
      this.gitignoreChecked = true;
      await ensureCoverageInGitignore(this.workspaceRoot);
    }
    const cfg = vscode.workspace.getConfiguration('coverlens');
    let runnerKey = cfg.get<string>('testRunner', 'auto');
    const customCmd = cfg.get<string>('testRunner.customCommand', '');

    if (runnerKey === 'auto') {
      runnerKey = await detectRunner(this.workspaceRoot);
      this.log.info(`Auto-detected runner: ${runnerKey}`);
    }

    let command: string;
    if (runnerKey === 'custom' && customCmd) {
      command = customCmd;
    } else {
      const preset = PRESETS[runnerKey];
      if (!preset) {
        vscode.window.showErrorMessage(`CoverLens: unknown test runner "${runnerKey}"`);
        return;
      }
      command = preset.command;
    }

    this.log.info(`Running: ${command}`);

    const showNotifications = cfg.get<boolean>('showRunnerNotifications', false);

    if (showNotifications) {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'CoverLens: running tests…',
        cancellable: true
      }, (progress, token) => this.exec(command, token));
    } else {
      await this.exec(command);
    }
  }

  private exec(command: string, token?: vscode.CancellationToken): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const proc = cp.exec(command, { cwd: this.workspaceRoot }, (err, stdout, stderr) => {
        // Clear reference when process ends
        if (this.activeProc === proc) this.activeProc = null;

        if (err) {
          // Don't treat abort as an error
          if ((err as any).killed || err.message === 'Cancelled') {
            this.log.info('Test run aborted.');
            resolve();
            return;
          }
          this.log.error(stderr || err.message);
          reject(err);
        } else {
          this.log.info('Tests completed. Coverage file updated.');
          resolve();
        }
      });

      this.activeProc = proc;

      token?.onCancellationRequested(() => {
        this.abort();
        resolve();
      });
    });
  }
}
