import * as path from 'path';
import * as fg from 'fast-glob';
import { CoverageMap } from './types';
import { parseLcov } from './parser/lcov';
import { parseCobertura } from './parser/cobertura';
import { parseJacoco } from './parser/jacoco';
import { parseGoCover } from './parser/gocover';
import { Logger } from '../util/logger';

type CoverageFormat = 'lcov' | 'cobertura' | 'jacoco' | 'gocover' | 'unknown';

function detectFormat(filePath: string, content: string): CoverageFormat {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'lcov.info' || base.endsWith('.lcov') || content.includes('SF:')) return 'lcov';
  if (content.includes('<coverage') && content.includes('line-rate')) return 'cobertura';
  if (content.includes('<report') && content.includes('jacoco')) return 'jacoco';
  // Go coverage profile starts with "mode: set|count|atomic"
  if (base === 'coverage.out' || base.endsWith('.coverprofile') || content.startsWith('mode:')) return 'gocover';
  return 'unknown';
}

/** Load all coverage files matching the given globs, merge into one map */
export async function loadCoverage(
  globs: string[],
  excludePatterns: string[],
  workspaceRoot: string,
  log: Logger
): Promise<CoverageMap> {
  const files = await fg.glob(globs, {
    cwd: workspaceRoot,
    absolute: true,
    ignore: excludePatterns
  });

  log.info(`CoverLens: found ${files.length} coverage file(s)`);

  const merged: CoverageMap = new Map();

  for (const file of files) {
    try {
      const fs = await import('fs');
      const content = await fs.promises.readFile(file, 'utf8');
      const format = detectFormat(file, content);
      log.info(`  parsing ${file} as ${format}`);

      let partial: CoverageMap;
      if (format === 'lcov') {
        partial = await parseLcov(file, workspaceRoot);
      } else if (format === 'cobertura') {
        partial = await parseCobertura(file, workspaceRoot);
      } else if (format === 'jacoco') {
        partial = await parseJacoco(file, workspaceRoot);
      } else if (format === 'gocover') {
        partial = await parseGoCover(file, workspaceRoot);
      } else {
        log.warn(`  unknown format, skipping: ${file}`);
        continue;
      }

      for (const [k, v] of partial) {
        merged.set(k, v);
      }
    } catch (err) {
      log.error(`  failed to parse ${file}: ${err}`);
    }
  }

  return merged;
}
