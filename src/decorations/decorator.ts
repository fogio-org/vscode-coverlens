import * as vscode from 'vscode';
import { CoverageState, FileCoverage } from '../coverage/types';
import { defaultTheme } from './themes';

export class CoverageDecorator {
  private decorationTypes: Map<CoverageState, vscode.TextEditorDecorationType> = new Map();
  private enabled = false;

  constructor() {
    this.createDecorationTypes();
  }

  private createDecorationTypes(): void {
    for (const state of Object.values(CoverageState)) {
      const theme = defaultTheme[state];
      this.decorationTypes.set(
        state,
        vscode.window.createTextEditorDecorationType({
          backgroundColor: theme.backgroundColor,
          overviewRulerColor: theme.overviewRulerColor,
          overviewRulerLane: vscode.OverviewRulerLane.Left,
          gutterIconSize: '75%',
          isWholeLine: true,
        }),
      );
    }
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.clearAll();
    }
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  apply(editor: vscode.TextEditor, coverage: FileCoverage): void {
    if (!this.enabled) {
      return;
    }

    const decorations = new Map<CoverageState, vscode.DecorationOptions[]>();
    for (const state of Object.values(CoverageState)) {
      decorations.set(state, []);
    }

    const branchLines = new Set(
      coverage.branches
        .filter(b => b.taken === 0)
        .map(b => b.lineNumber),
    );

    for (const line of coverage.lines) {
      const lineIndex = line.lineNumber - 1;
      if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
        continue;
      }

      let state: CoverageState;
      if (line.executionCount === 0) {
        state = CoverageState.Uncovered;
      } else if (branchLines.has(line.lineNumber)) {
        state = CoverageState.Partial;
      } else {
        state = CoverageState.Covered;
      }

      const range = editor.document.lineAt(lineIndex).range;
      decorations.get(state)!.push({ range });
    }

    for (const [state, type] of this.decorationTypes) {
      editor.setDecorations(type, decorations.get(state) ?? []);
    }
  }

  clearAll(): void {
    for (const type of this.decorationTypes.values()) {
      for (const editor of vscode.window.visibleTextEditors) {
        editor.setDecorations(type, []);
      }
    }
  }

  dispose(): void {
    for (const type of this.decorationTypes.values()) {
      type.dispose();
    }
    this.decorationTypes.clear();
  }
}
