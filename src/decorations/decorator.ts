import * as vscode from 'vscode';
import { CoverageMap, LineState, FileCoverage } from '../coverage/types';
import { buildTheme } from './themes';
import { normalizePath } from '../util/paths';

export class CoverageDecorator {
  private coveredType!: vscode.TextEditorDecorationType;
  private partialType!: vscode.TextEditorDecorationType;
  private uncoveredType!: vscode.TextEditorDecorationType;

  // Dimmed types for stale coverage (dirty files)
  private coveredDimType!: vscode.TextEditorDecorationType;
  private partialDimType!: vscode.TextEditorDecorationType;
  private uncoveredDimType!: vscode.TextEditorDecorationType;

  private disposables: vscode.Disposable[] = [];
  private enabled = false;
  private coverageMap: CoverageMap = new Map();
  private diffLines: Map<string, Set<number>> | null = null;
  private dirtyFiles: Set<string> = new Set();

  constructor(private readonly ctx: vscode.ExtensionContext) {
    this.createDecorationTypes();

    this.disposables.push(
      // Re-apply when active editor changes
      vscode.window.onDidChangeActiveTextEditor(e => {
        if (e && this.enabled) this.applyToEditor(e);
      }),

      // React to config changes
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('coverlens')) {
          this.createDecorationTypes();
          this.applyToAllEditors();
        }
      }),

      // Track dirty files — hide or dim stale coverage
      vscode.workspace.onDidChangeTextDocument(e => {
        if (!this.enabled) return;
        const filePath = normalizePath(e.document.uri.fsPath);
        if (!this.coverageMap.has(filePath)) return;
        if (!this.dirtyFiles.has(filePath)) {
          this.dirtyFiles.add(filePath);
          // Re-apply to this file's editors with stale handling
          for (const editor of vscode.window.visibleTextEditors) {
            if (normalizePath(editor.document.uri.fsPath) === filePath) {
              this.applyToEditor(editor);
            }
          }
        }
      }),

      // When file is saved, keep it dirty (coverage is still stale)
      // It becomes clean only when new coverage data arrives via setCoverage()

      // When file reverts to clean (undo all changes), remove dirty flag
      vscode.workspace.onDidSaveTextDocument(() => {
        // Save doesn't make coverage fresh — only new coverage data does
      })
    );
  }

  private createDecorationTypes(): void {
    this.coveredType?.dispose();
    this.partialType?.dispose();
    this.uncoveredType?.dispose();
    this.coveredDimType?.dispose();
    this.partialDimType?.dispose();
    this.uncoveredDimType?.dispose();

    const cfg = vscode.workspace.getConfiguration('coverlens');
    const style = cfg.get<'border' | 'highlight'>('decorationStyle', 'border');
    const colors = {
      covered:   cfg.get<string>('colors.covered',   ''),
      partial:   cfg.get<string>('colors.partial',   ''),
      uncovered: cfg.get<string>('colors.uncovered', ''),
    };
    const showOverviewRuler = cfg.get<boolean>('overviewRuler', false);

    const theme = buildTheme(style, colors, showOverviewRuler);
    this.coveredType   = vscode.window.createTextEditorDecorationType(theme.covered);
    this.partialType   = vscode.window.createTextEditorDecorationType(theme.partial);
    this.uncoveredType = vscode.window.createTextEditorDecorationType(theme.uncovered);

    // Dimmed versions (reduced opacity) for stale coverage
    const dimTheme = buildTheme(style, {
      covered:   'rgba(64, 173, 100, 0.2)',
      partial:   'rgba(220, 170, 50, 0.2)',
      uncovered: 'rgba(200, 60, 60, 0.2)',
    }, false);
    this.coveredDimType   = vscode.window.createTextEditorDecorationType(dimTheme.covered);
    this.partialDimType   = vscode.window.createTextEditorDecorationType(dimTheme.partial);
    this.uncoveredDimType = vscode.window.createTextEditorDecorationType(dimTheme.uncovered);
  }

  setCoverage(map: CoverageMap): void {
    this.coverageMap = map;
    // New coverage data arrived — all files are fresh again
    this.dirtyFiles.clear();
    if (this.enabled) this.applyToAllEditors();
  }

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
      this.clearEditor(editor);
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

  private clearEditor(editor: vscode.TextEditor): void {
    editor.setDecorations(this.coveredType, []);
    editor.setDecorations(this.partialType, []);
    editor.setDecorations(this.uncoveredType, []);
    editor.setDecorations(this.coveredDimType, []);
    editor.setDecorations(this.partialDimType, []);
    editor.setDecorations(this.uncoveredDimType, []);
  }

  private applyToEditor(editor: vscode.TextEditor): void {
    const filePath = normalizePath(editor.document.uri.fsPath);
    const fc = this.coverageMap.get(filePath);

    if (!fc) {
      this.clearEditor(editor);
      return;
    }

    const cfg = vscode.workspace.getConfiguration('coverlens');
    const onEdit = cfg.get<'hide' | 'dim' | 'keep'>('onEdit', 'hide');
    const isDirty = this.dirtyFiles.has(filePath);

    // If file is dirty and mode is "hide", clear all decorations
    if (isDirty && onEdit === 'hide') {
      this.clearEditor(editor);
      return;
    }

    // Choose normal or dimmed decoration types
    const useDim = isDirty && onEdit === 'dim';
    const covType   = useDim ? this.coveredDimType   : this.coveredType;
    const parType   = useDim ? this.partialDimType   : this.partialType;
    const uncType   = useDim ? this.uncoveredDimType  : this.uncoveredType;
    const clearCov  = useDim ? this.coveredType       : this.coveredDimType;
    const clearPar  = useDim ? this.partialType       : this.partialDimType;
    const clearUnc  = useDim ? this.uncoveredType     : this.uncoveredDimType;

    // Clear the opposite set (normal vs dim)
    editor.setDecorations(clearCov, []);
    editor.setDecorations(clearPar, []);
    editor.setDecorations(clearUnc, []);

    // Diff filter: null = diff mode off; Map = diff mode on
    // If diff mode on but file not in diff → no lines to show
    const diffActive = this.diffLines !== null;
    const allowedLines = diffActive ? (this.diffLines!.get(filePath) ?? new Set<number>()) : null;

    const covered: vscode.Range[] = [];
    const partial: vscode.Range[] = [];
    const uncovered: vscode.Range[] = [];

    for (const [lineNo, hits] of fc.lines) {
      const editorLine = lineNo - 1;
      if (editorLine < 0 || editorLine >= editor.document.lineCount) continue;
      if (allowedLines && !allowedLines.has(lineNo)) continue;

      const range = editor.document.lineAt(editorLine).range;
      const state = getLineState(lineNo, hits, fc);

      if (state === 'covered')   covered.push(range);
      else if (state === 'partial') partial.push(range);
      else if (state === 'uncovered') uncovered.push(range);
    }

    editor.setDecorations(covType, covered);
    editor.setDecorations(parType, partial);
    editor.setDecorations(uncType, uncovered);
  }

  dispose(): void {
    this.disable();
    this.coveredType.dispose();
    this.partialType.dispose();
    this.uncoveredType.dispose();
    this.coveredDimType.dispose();
    this.partialDimType.dispose();
    this.uncoveredDimType.dispose();
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
  if (takenCount < branches.length) return 'partial';
  return 'covered';
}
