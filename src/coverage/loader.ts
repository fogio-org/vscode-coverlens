import * as fs from 'fs';
import * as path from 'path';
import { CoverageData, CoverageFormat, FileCoverage } from './types';
import { parseLcov } from './parser/lcov';
import { parseCobertura } from './parser/cobertura';
import { parseClover } from './parser/clover';
import { parseJacoco } from './parser/jacoco';
import { log, logError } from '../util/logger';

export function detectFormat(filePath: string, content: string): CoverageFormat | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();

  if (baseName.includes('lcov') || ext === '.info') {
    return 'lcov';
  }

  if (content.includes('<coverage') && content.includes('cobertura')) {
    return 'cobertura';
  }

  if (content.includes('<coverage') && content.includes('clover')) {
    return 'clover';
  }

  if (content.includes('<report') && content.includes('jacoco')) {
    return 'jacoco';
  }

  // Fallback heuristics
  if (content.trimStart().startsWith('TN:') || content.includes('end_of_record')) {
    return 'lcov';
  }

  if (content.includes('<coverage')) {
    return 'cobertura';
  }

  return undefined;
}

export async function loadCoverageFile(filePath: string, basePath: string): Promise<CoverageData | undefined> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const format = detectFormat(filePath, content);

    if (!format) {
      log(`Unknown coverage format for ${filePath}`);
      return undefined;
    }

    log(`Loading ${format} coverage from ${filePath}`);
    let files: Map<string, FileCoverage>;

    switch (format) {
      case 'lcov':
        files = parseLcov(content, basePath);
        break;
      case 'cobertura':
        files = await parseCobertura(content, basePath);
        break;
      case 'clover':
        files = await parseClover(content, basePath);
        break;
      case 'jacoco':
        files = await parseJacoco(content, basePath);
        break;
    }

    return {
      files,
      timestamp: Date.now(),
      source: filePath,
    };
  } catch (error) {
    logError(`Failed to load coverage from ${filePath}`, error);
    return undefined;
  }
}
