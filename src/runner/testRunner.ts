import * as vscode from 'vscode';
import * as cp from 'child_process';
import { PRESETS, detectRunner } from './presets';
import { Logger } from '../util/logger';

export class TestRunner {
  constructor(
    private readonly workspaceRoot: string,
    private readonly log: Logger
  ) {}

  async run(): Promise<void> {
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

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'CoverLens: running tests…',
      cancellable: true
    }, async (progress, token) => {
      return new Promise<void>((resolve, reject) => {
        const proc = cp.exec(command, { cwd: this.workspaceRoot }, (err, stdout, stderr) => {
          if (err) {
            this.log.error(stderr);
            vscode.window.showErrorMessage(`CoverLens: tests failed. Check Output panel.`);
            reject(err);
          } else {
            this.log.info('Tests completed. Coverage file updated.');
            resolve();
          }
        });

        token.onCancellationRequested(() => {
          proc.kill();
          reject(new Error('Cancelled'));
        });
      });
    });
  }
}
