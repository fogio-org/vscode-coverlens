import * as vscode from 'vscode';
import { FileCoverage, LineState } from '../coverage/types';
import { defaultTheme } from './themes';

const LINE_STATES: LineState[] = ['covered', 'partial', 'uncovered'];

export class CoverageDecorator {
  private decorationTypes: Map<LineState, vscode.TextEditorDecorationType> = new Map();
  private enabled = false;

  constructor() {
    this.createDecorationTypes();
  }

  private createDecorationTypes(): void {
    for (const state of LINE_STATES) {
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

    const decorations = new Map<LineState, vscode.DecorationOptions[]>();
    for (const state of LINE_STATES) {
      decorations.set(state, []);
    }

    for (const [lineNumber, hits] of coverage.lines) {
      const lineIndex = lineNumber - 1;
      if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
        continue;
      }

      let state: LineState;
      if (hits === 0) {
        state = 'uncovered';
      } else {
        // Check if this line has partial branch coverage
        const branches = coverage.branches.get(lineNumber);
        if (branches && branches.length > 0) {
          const takenCount = branches.filter(b => b.taken > 0).length;
          if (takenCount > 0 && takenCount < branches.length) {
            state = 'partial';
          } else {
            state = 'covered';
          }
        } else {
          state = 'covered';
        }
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
