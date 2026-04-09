import * as fs from 'fs';
import * as path from 'path';
import * as fg from 'fast-glob';
import { CoverageMap } from './types';
import { parseLcov } from './parser/lcov';
import { parseCobertura } from './parser/cobertura';
import { parseJacoco } from './parser/jacoco';
import { parseGoCover } from './parser/gocover';
import { parseIstanbul } from './parser/istanbul';
import { Logger } from '../util/logger';

type CoverageFormat = 'lcov' | 'cobertura' | 'jacoco' | 'gocover' | 'istanbul-json' | 'unknown';

function detectFormat(filePath: string, content: string): CoverageFormat {
  const base = path.basename(filePath).toLowerCase();

  // LCOV text format
  if (base === 'lcov.info' || base.endsWith('.lcov') || content.includes('SF:')) return 'lcov';

  // XML formats — check content to distinguish
  if (content.trimStart().startsWith('<')) {
    if (content.includes('<report') && content.includes('jacoco')) return 'jacoco';
    if (content.includes('<coverage') && content.includes('line-rate')) return 'cobertura';
  }

  // Go coverage profile: "mode: set|count|atomic"
  if (base === 'coverage.out' || base === 'cover.out' || base.endsWith('.coverprofile') || content.startsWith('mode:')) return 'gocover';

  // Istanbul/NYC JSON format (coverage.json, coverage-final.json)
  if (base.endsWith('.json') && content.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      const firstKey = Object.keys(parsed)[0];
      if (firstKey && parsed[firstKey]?.statementMap) return 'istanbul-json';
    } catch { /* not valid JSON */ }
  }

  return 'unknown';
}

export interface LoadResult {
  map: CoverageMap;
  /** Absolute paths of the coverage files that were parsed */
  coverageFiles: string[];
}

/** Load all coverage files matching the given globs, merge into one map */
export async function loadCoverage(
  globs: string[],
  excludePatterns: string[],
  workspaceRoot: string,
  log: Logger
): Promise<LoadResult> {
  const files = await fg.glob(globs, {
    cwd: workspaceRoot,
    absolute: true,
    ignore: excludePatterns
  });

  log.info(`CoverLens: found ${files.length} coverage file(s)`);

  const merged: CoverageMap = new Map();
  const parsedFiles: string[] = [];

  for (const file of files) {
    try {
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
      } else if (format === 'istanbul-json') {
        partial = await parseIstanbul(file, workspaceRoot);
      } else {
        log.warn(`  unknown format, skipping: ${file}`);
        continue;
      }

      for (const [k, v] of partial) {
        merged.set(k, v);
      }
      parsedFiles.push(file);
    } catch (err) {
      log.error(`  failed to parse ${file}: ${err}`);
    }
  }

  return { map: merged, coverageFiles: parsedFiles };
}
