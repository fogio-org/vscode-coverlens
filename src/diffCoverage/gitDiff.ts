import * as cp from 'child_process';
import * as path from 'path';
import { normalizePath } from '../util/paths';

/** Returns map of absolute file path → set of changed line numbers */
export async function getChangedLines(
  workspaceRoot: string,
  base: string
): Promise<Map<string, Set<number>>> {
  return new Promise((resolve, reject) => {
    // Validate base ref to prevent shell injection
    if (!/^[\w.\/\-~@^{}]+$/.test(base)) {
      reject(new Error(`Invalid diffBase ref: "${base}"`));
      return;
    }
    // git diff --unified=0 shows only changed lines with no context
    cp.execFile(
      'git', ['diff', '--unified=0', base],
      { cwd: workspaceRoot },
      (err, stdout, stderr) => {
        if (err) { reject(new Error(stderr || err.message)); return; }
        resolve(parseDiffOutput(stdout, workspaceRoot));
      }
    );
  });
}

function parseDiffOutput(diff: string, workspaceRoot: string): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  let currentFile: string | null = null;

  for (const line of diff.split('\n')) {
    // +++ b/src/foo.ts
    if (line.startsWith('+++ b/')) {
      const rel = line.slice(6).trim();
      currentFile = normalizePath(path.resolve(workspaceRoot, rel));
      if (!result.has(currentFile)) result.set(currentFile, new Set());
    }
    // @@ -old +new,count @@
    else if (line.startsWith('@@') && currentFile) {
      const m = line.match(/\+(\d+)(?:,(\d+))?/);
      if (m) {
        const start = parseInt(m[1], 10);
        const count = m[2] !== undefined ? parseInt(m[2], 10) : 1;
        const lines = result.get(currentFile)!;
        for (let i = 0; i < count; i++) lines.add(start + i);
      }
    }
  }

  return result;
}
