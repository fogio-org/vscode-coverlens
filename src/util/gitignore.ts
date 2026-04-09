import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as vscode from 'vscode';

/**
 * Check if discovered coverage files are git-ignored.
 * If any are tracked by git, prompt the user to add patterns to .gitignore.
 *
 * Uses `git check-ignore` so it respects wildcards, nested .gitignore files,
 * global gitignore config, and negation patterns.
 */
export async function ensureCoverageInGitignore(
  workspaceRoot: string,
  coverageFilePaths: string[]
): Promise<void> {
  if (!coverageFilePaths.length) return;

  // Only act if this is a git repo
  if (!fs.existsSync(path.join(workspaceRoot, '.git'))) return;

  const notIgnored = await findNotIgnored(workspaceRoot, coverageFilePaths);
  if (!notIgnored.length) return;

  // Build human-readable list (show basenames, deduplicate)
  const names = [...new Set(notIgnored.map(f => path.basename(f)))];
  const preview = names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;

  const answer = await vscode.window.showInformationMessage(
    `CoverLens: coverage files not in .gitignore (${preview}). Add them?`,
    'Add to .gitignore',
    'Ignore'
  );

  if (answer !== 'Add to .gitignore') return;

  // Generate minimal patterns from the actual file paths
  const patterns = buildPatterns(workspaceRoot, notIgnored);
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  const block = '\n# Coverage files (added by CoverLens)\n' + patterns.join('\n') + '\n';

  await fs.promises.appendFile(gitignorePath, block);
  vscode.window.showInformationMessage('CoverLens: updated .gitignore with coverage patterns.');
}

/**
 * Use `git check-ignore` to find which files are NOT ignored.
 * Returns paths that git would track (i.e. not in any .gitignore).
 */
async function findNotIgnored(workspaceRoot: string, filePaths: string[]): Promise<string[]> {
  // git check-ignore exits 0 if files are ignored, 1 if not.
  // With --stdin we can check many files at once.
  // It prints only the ignored files, so we diff to find not-ignored ones.
  return new Promise(resolve => {
    const proc = cp.execFile(
      'git', ['check-ignore', '--stdin'],
      { cwd: workspaceRoot },
      (err, stdout) => {
        const ignored = new Set(
          stdout.trim().split('\n').filter(Boolean).map(l => l.trim())
        );
        const notIgnored = filePaths.filter(f => !ignored.has(f));
        resolve(notIgnored);
      }
    );

    // Feed file paths via stdin
    proc.stdin?.write(filePaths.join('\n'));
    proc.stdin?.end();
  });
}

/**
 * Build .gitignore patterns from actual file paths.
 * Uses basename when multiple files share the same name,
 * otherwise uses workspace-relative path.
 */
function buildPatterns(workspaceRoot: string, filePaths: string[]): string[] {
  const seen = new Set<string>();
  const patterns: string[] = [];

  for (const abs of filePaths) {
    const base = path.basename(abs);
    // Use basename as pattern — covers the file anywhere in the tree
    if (!seen.has(base)) {
      seen.add(base);
      patterns.push(base);
    }
  }

  // Also add parent directories named "coverage" if present
  for (const abs of filePaths) {
    const rel = path.relative(workspaceRoot, abs);
    const parts = rel.split(path.sep);
    for (const part of parts) {
      if (part.toLowerCase() === 'coverage' && !seen.has('coverage/')) {
        seen.add('coverage/');
        patterns.push('coverage/');
      }
    }
  }

  return patterns;
}
