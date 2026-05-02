import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadCoverage } from '../coverage/loader';
import { Logger } from '../util/logger';

const SAMPLE_LCOV = `
SF:src/index.ts
DA:1,1
DA:2,0
end_of_record
`.trim();

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverlens-loader-'));
  const covDir = path.join(tmpRoot, 'coverage');
  fs.mkdirSync(covDir, { recursive: true });
  fs.writeFileSync(path.join(covDir, 'lcov.info'), SAMPLE_LCOV);
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('overlapping glob patterns do not produce duplicate file entries', async () => {
  const log = new Logger();
  const result = await loadCoverage(
    ['**/lcov.info', '**/coverage/lcov.info', '**/lcov-report/lcov.info'],
    [],
    tmpRoot,
    log
  );

  expect(result.coverageFiles).toHaveLength(1);
  expect(result.map.size).toBe(1);
});

test('skipPaths prevents the same file from being parsed twice across roots', async () => {
  const log = new Logger();
  const seen = new Set<string>();

  const first = await loadCoverage(['**/lcov.info'], [], tmpRoot, log, seen);
  expect(first.coverageFiles).toHaveLength(1);
  for (const f of first.coverageFiles) seen.add(f);

  // Second call on the same root should find the same file but skip it.
  const second = await loadCoverage(['**/lcov.info'], [], tmpRoot, log, seen);
  expect(second.coverageFiles).toHaveLength(0);
  expect(second.map.size).toBe(0);
});
