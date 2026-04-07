import * as fs from 'fs';
import * as path from 'path';

/**
 * Merge a partial Go coverage profile into the main one.
 *
 * Go coverage profile format:
 *   mode: set
 *   github.com/user/pkg/file.go:10.2,12.0 1 5
 *
 * Strategy: replace all lines for files that appear in the partial profile,
 * keep everything else from the main profile.
 */
export async function mergeGoCoverProfiles(
  workspaceRoot: string,
  mainFile: string,
  partialFile: string
): Promise<void> {
  const mainPath = path.resolve(workspaceRoot, mainFile);
  const partialPath = path.resolve(workspaceRoot, partialFile);

  // Read partial file
  let partialContent: string;
  try {
    partialContent = await fs.promises.readFile(partialPath, 'utf8');
  } catch {
    return; // Partial file doesn't exist (tests may have failed)
  }

  // Parse partial: collect file names and their lines
  const partialLines: string[] = [];
  const partialFiles = new Set<string>();
  let mode = 'set';

  for (const line of partialContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('mode:')) {
      mode = trimmed.split(':')[1]?.trim() || 'set';
      continue;
    }
    // Extract file name: everything before the first ':'
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      partialFiles.add(trimmed.slice(0, colonIdx));
      partialLines.push(trimmed);
    }
  }

  if (partialFiles.size === 0) {
    // No coverage data in partial — clean up and skip
    try { await fs.promises.unlink(partialPath); } catch { /* ignore */ }
    return;
  }

  // Read main file (may not exist on very first run)
  let mainContent = '';
  try {
    mainContent = await fs.promises.readFile(mainPath, 'utf8');
  } catch {
    // Main doesn't exist — just rename partial to main
    await fs.promises.rename(partialPath, mainPath);
    return;
  }

  // Filter main: keep lines for files NOT in the partial set
  const mergedLines: string[] = [`mode: ${mode}`];
  for (const line of mainContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('mode:')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const fileName = trimmed.slice(0, colonIdx);
      if (!partialFiles.has(fileName)) {
        mergedLines.push(trimmed);
      }
    }
  }

  // Append all partial lines
  mergedLines.push(...partialLines);

  // Write merged result to main
  await fs.promises.writeFile(mainPath, mergedLines.join('\n') + '\n');

  // Clean up partial file
  try { await fs.promises.unlink(partialPath); } catch { /* ignore */ }
}
