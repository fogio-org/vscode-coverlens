import { execSync } from 'child_process';

export interface DiffLine {
  filePath: string;
  lineNumber: number;
}

export function getChangedLines(workspaceRoot: string, base: string): DiffLine[] {
  const changedLines: DiffLine[] = [];

  try {
    const output = execSync(`git diff --unified=0 ${base}`, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    let currentFile = '';
    for (const line of output.split('\n')) {
      if (line.startsWith('+++ b/')) {
        currentFile = line.slice(6);
      } else if (line.startsWith('@@')) {
        const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
        if (match && currentFile) {
          const start = Number(match[1]);
          const count = Number(match[2] ?? 1);
          for (let i = 0; i < count; i++) {
            changedLines.push({ filePath: currentFile, lineNumber: start + i });
          }
        }
      }
    }
  } catch {
    // git diff may fail if not in a git repo — silently return empty
  }

  return changedLines;
}
