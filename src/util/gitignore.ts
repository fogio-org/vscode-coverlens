import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** Coverage file patterns that should be in .gitignore */
const COVERAGE_PATTERNS = [
  'coverage/',
  'lcov.info',
  'coverage.out',
  '*.coverprofile',
  'coverage.xml',
  'coverage.cobertura.xml',
  'jacoco.xml',
  'coverage.json',
  'coverage-final.json',
];

/**
 * Check if .gitignore already contains coverage patterns.
 * If not, prompt the user to add them.
 */
export async function ensureCoverageInGitignore(workspaceRoot: string): Promise<void> {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');

  // Only act if this is a git repo
  if (!fs.existsSync(path.join(workspaceRoot, '.git'))) return;

  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
  }

  // Check if any coverage patterns are already present
  const lines = content.split('\n').map(l => l.trim());
  const missing = COVERAGE_PATTERNS.filter(p => !lines.some(l => l === p || l === `/${p}`));

  // If most patterns already exist, skip
  if (missing.length <= 2) return;

  const answer = await vscode.window.showInformationMessage(
    'CoverLens: coverage files may end up in git. Add them to .gitignore?',
    'Add to .gitignore',
    'Ignore'
  );

  if (answer !== 'Add to .gitignore') return;

  const block = '\n# Coverage files (added by CoverLens)\n' + missing.join('\n') + '\n';

  fs.appendFileSync(gitignorePath, block);
  vscode.window.showInformationMessage('CoverLens: updated .gitignore with coverage patterns.');
}
