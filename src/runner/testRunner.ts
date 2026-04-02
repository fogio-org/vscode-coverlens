import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { log, logError } from '../util/logger';
import { TestPreset } from './presets';

export class TestRunner {
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  async run(preset: TestPreset, workspaceRoot: string): Promise<boolean> {
    if (this.running) {
      vscode.window.showWarningMessage('CoverLens: A test run is already in progress.');
      return false;
    }

    this.running = true;
    const args = [...preset.coverageArgs];
    const fullCommand = `${preset.command} ${args.join(' ')}`;
    log(`Running: ${fullCommand} in ${workspaceRoot}`);

    return new Promise<boolean>((resolve) => {
      const parts = preset.command.split(' ');
      const proc = spawn(parts[0], [...parts.slice(1), ...args], {
        cwd: workspaceRoot,
        shell: true,
      });

      proc.stdout?.on('data', (data) => log(data.toString()));
      proc.stderr?.on('data', (data) => log(data.toString()));

      proc.on('close', (code) => {
        this.running = false;
        if (code === 0) {
          log('Test run completed successfully');
          resolve(true);
        } else {
          logError(`Test run failed with exit code ${code}`);
          resolve(false);
        }
      });

      proc.on('error', (error) => {
        this.running = false;
        logError('Failed to start test runner', error);
        resolve(false);
      });
    });
  }

  dispose(): void {
    // Nothing to clean up currently
  }
}
