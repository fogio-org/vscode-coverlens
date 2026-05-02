import * as fs from 'fs';
import * as path from 'path';
import * as fg from 'fast-glob';
import { CoverageMap, FileCoverage } from './types';
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
  log: Logger,
  skipPaths?: Set<string>
): Promise<LoadResult> {
  const matched = await fg.glob(globs, {
    cwd: workspaceRoot,
    absolute: true,
    ignore: excludePatterns
  });

  // Overlapping glob patterns (e.g. **/lcov.info and **/coverage/lcov.info)
  // can match the same file; skipPaths lets the caller dedupe across multiple
  // workspaceRoots in monorepo mode.
  const files = [...new Set(matched)].filter(f => !skipPaths?.has(f));

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
        const existing = merged.get(k);
        if (existing) {
          mergeCoverage(existing, v);
        } else {
          merged.set(k, v);
        }
      }
      parsedFiles.push(file);
    } catch (err) {
      log.error(`  failed to parse ${file}: ${err}`);
    }
  }

  return { map: merged, coverageFiles: parsedFiles };
}

/** Merge source coverage into target, summing hit counts and recomputing metrics */
function mergeCoverage(target: FileCoverage, source: FileCoverage): void {
  for (const [line, hits] of source.lines) {
    target.lines.set(line, (target.lines.get(line) ?? 0) + hits);
  }
  for (const [line, bds] of source.branches) {
    if (!target.branches.has(line)) {
      target.branches.set(line, [...bds]);
    } else {
      const existing = target.branches.get(line)!;
      bds.forEach((bd, i) => {
        if (existing[i]) existing[i].taken += bd.taken;
        else existing.push({ ...bd });
      });
    }
  }
  // Recompute metrics
  let covered = 0;
  for (const hits of target.lines.values()) if (hits > 0) covered++;
  target.metrics.totalLines = target.lines.size;
  target.metrics.coveredLines = covered;
  target.metrics.linePercent = target.metrics.totalLines === 0 ? 100
    : Math.round((covered / target.metrics.totalLines) * 100);

  let totalBr = 0, coveredBr = 0, partialLines = 0;
  for (const bds of target.branches.values()) {
    totalBr += bds.length;
    const taken = bds.filter(b => b.taken > 0).length;
    coveredBr += taken;
    if (taken > 0 && taken < bds.length) partialLines++;
  }
  target.metrics.totalBranches = totalBr;
  target.metrics.coveredBranches = coveredBr;
  target.metrics.partialBranches = partialLines;
  target.metrics.branchPercent = totalBr === 0 ? 100
    : Math.round((coveredBr / totalBr) * 100);
}
