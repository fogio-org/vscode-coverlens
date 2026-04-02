export const workspace = {
  getConfiguration: () => ({ get: (key: string, def: any) => def }),
  workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
  onDidChangeConfiguration: () => ({ dispose: () => {} })
};
export const window = {
  createOutputChannel: () => ({ appendLine: () => {}, show: () => {}, dispose: () => {} }),
  createTextEditorDecorationType: () => ({ dispose: () => {} }),
  visibleTextEditors: [],
  onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  withProgress: async (_: any, fn: any) => fn({ report: () => {} }, { onCancellationRequested: () => {} })
};
export enum OverviewRulerLane { Left = 1 }
export class ThemeIcon { constructor(public id: string, public color?: any) {} }
export class ThemeColor { constructor(public id: string) {} }
export class Uri {
  static file = (p: string) => ({ fsPath: p, scheme: 'file' });
  static parse = (s: string) => ({ toString: () => s });
}
export class Range {
  constructor(public start: any, public end: any) {}
}
export enum TreeItemCollapsibleState { None = 0, Collapsed = 1, Expanded = 2 }
export class TreeItem {
  constructor(public label: string, public collapsibleState?: any) {}
}
export enum StatusBarAlignment { Right = 2 }
export enum ProgressLocation { Notification = 15 }
export const commands = { registerCommand: (id: string, fn: any) => ({ dispose: () => {} }) };
export const ExtensionContext = class {};
