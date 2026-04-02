import * as vscode from 'vscode';
import { CoverageMap, LineState, FileCoverage } from '../coverage/types';
import { buildTheme } from './themes';
import { normalizePath } from '../util/paths';

export class CoverageDecorator {
  private coveredType!: vscode.TextEditorDecorationType;
  private partialType!: vscode.TextEditorDecorationType;
  private uncoveredType!: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];
  private enabled = false;
  private coverageMap: CoverageMap = new Map();
  private diffLines: Map<string, Set<number>> | null = null; // null = no diff filter

  constructor(private readonly ctx: vscode.ExtensionContext) {
    this.createDecorationTypes();

    // Re-apply when active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(e => {
        if (e && this.enabled) this.applyToEditor(e);
      }),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('coverlens')) {
          this.createDecorationTypes();
          this.applyToAllEditors();
        }
      })
    );
  }

  private createDecorationTypes(): void {
    // Dispose old types first
    this.coveredType?.dispose();
    this.partialType?.dispose();
    this.uncoveredType?.dispose();

    const cfg = vscode.workspace.getConfiguration('coverlens');
    const style = cfg.get<'border' | 'highlight'>('decorationStyle', 'border');
    const colors = {
      covered:   cfg.get<string>('colors.covered',   ''),
      partial:   cfg.get<string>('colors.partial',   ''),
      uncovered: cfg.get<string>('colors.uncovered', ''),
    };

    const theme = buildTheme(style, colors);
    this.coveredType   = vscode.window.createTextEditorDecorationType(theme.covered);
    this.partialType   = vscode.window.createTextEditorDecorationType(theme.partial);
    this.uncoveredType = vscode.window.createTextEditorDecorationType(theme.uncovered);
  }

  /** Set the coverage data and re-decorate all open editors */
  setCoverage(map: CoverageMap): void {
    this.coverageMap = map;
    if (this.enabled) this.applyToAllEditors();
  }

  /** Set which lines to restrict to (diff mode). Pass null to show all. */
  setDiffFilter(diffLines: Map<string, Set<number>> | null): void {
    this.diffLines = diffLines;
    if (this.enabled) this.applyToAllEditors();
  }

  enable(): void {
    this.enabled = true;
    this.applyToAllEditors();
  }

  disable(): void {
    this.enabled = false;
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.coveredType, []);
      editor.setDecorations(this.partialType, []);
      editor.setDecorations(this.uncoveredType, []);
    }
  }

  toggle(): void {
    this.enabled ? this.disable() : this.enable();
  }

  get isEnabled(): boolean { return this.enabled; }

  private applyToAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.applyToEditor(editor);
    }
  }

  private applyToEditor(editor: vscode.TextEditor): void {
    const filePath = normalizePath(editor.document.uri.fsPath);
    const fc = this.coverageMap.get(filePath);

    if (!fc) {
      editor.setDecorations(this.coveredType, []);
      editor.setDecorations(this.partialType, []);
      editor.setDecorations(this.uncoveredType, []);
      return;
    }

    const allowedLines = this.diffLines?.get(filePath) ?? null;

    const covered: vscode.Range[] = [];
    const partial: vscode.Range[] = [];
    const uncovered: vscode.Range[] = [];

    for (const [lineNo, hits] of fc.lines) {
      const editorLine = lineNo - 1; // lcov is 1-based, VS Code is 0-based
      if (editorLine < 0 || editorLine >= editor.document.lineCount) continue;
      if (allowedLines && !allowedLines.has(lineNo)) continue;

      const range = editor.document.lineAt(editorLine).range;
      const state = getLineState(lineNo, hits, fc);

      if (state === 'covered')   covered.push(range);
      else if (state === 'partial') partial.push(range);
      else if (state === 'uncovered') uncovered.push(range);
    }

    editor.setDecorations(this.coveredType, covered);
    editor.setDecorations(this.partialType, partial);
    editor.setDecorations(this.uncoveredType, uncovered);
  }

  dispose(): void {
    this.disable();
    this.coveredType.dispose();
    this.partialType.dispose();
    this.uncoveredType.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

/** Determine three-state line coverage */
function getLineState(lineNo: number, hits: number, fc: FileCoverage): LineState {
  if (hits === 0) return 'uncovered';

  const branches = fc.branches.get(lineNo);
  if (!branches || branches.length === 0) return 'covered';

  const takenCount = branches.filter(b => b.taken > 0).length;
  if (takenCount === 0) return 'uncovered';
  if (takenCount < branches.length) return 'partial'; // some branches not taken
  return 'covered';
}
