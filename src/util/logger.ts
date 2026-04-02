import * as vscode from 'vscode';

export class Logger {
  private channel: vscode.OutputChannel;

  constructor() {
    this.channel = vscode.window.createOutputChannel('CoverLens');
  }

  info(msg: string): void { this.channel.appendLine(`[INFO]  ${msg}`); }
  warn(msg: string): void { this.channel.appendLine(`[WARN]  ${msg}`); }
  error(msg: string): void { this.channel.appendLine(`[ERROR] ${msg}`); }
  show(): void { this.channel.show(); }
  dispose(): void { this.channel.dispose(); }
}
