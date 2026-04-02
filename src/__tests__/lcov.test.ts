import { parseLcov } from '../coverage/parser/lcov';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_DIR = path.join(__dirname, 'fixtures');

const SIMPLE_LCOV = `
SF:src/index.ts
DA:1,5
DA:2,0
DA:3,3
BRDA:3,0,0,2
BRDA:3,0,1,0
end_of_record
`.trim();

test('parses line coverage', async () => {
  const tmpFile = path.join(FIXTURE_DIR, 'test.lcov');
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(tmpFile, SIMPLE_LCOV);

  const map = await parseLcov(tmpFile, '/workspace');
  // Should have one entry (path will be resolved)
  expect(map.size).toBe(1);

  const [, fc] = [...map.entries()][0];
  expect(fc.metrics.totalLines).toBe(3);
  expect(fc.metrics.coveredLines).toBe(2); // lines 1 and 3
  expect(fc.metrics.linePercent).toBe(67);
});

test('detects partial branch coverage', async () => {
  const tmpFile = path.join(FIXTURE_DIR, 'test.lcov');
  const map = await parseLcov(tmpFile, '/workspace');
  const [, fc] = [...map.entries()][0];

  // Line 3: branch 0 taken (2), branch 1 not taken (0) → partial
  expect(fc.metrics.totalBranches).toBe(2);
  expect(fc.metrics.coveredBranches).toBe(1);
  expect(fc.metrics.partialBranches).toBe(1);
});

test('three-state coverage on line 3', async () => {
  const tmpFile = path.join(FIXTURE_DIR, 'test.lcov');
  const map = await parseLcov(tmpFile, '/workspace');
  const [, fc] = [...map.entries()][0];

  // Line 3: hits=3, branch partial → state should be 'partial'
  const branches = fc.branches.get(3)!;
  const takenCount = branches.filter(b => b.taken > 0).length;
  expect(takenCount).toBe(1);           // one branch taken
  expect(takenCount).toBeLessThan(branches.length); // not all
});
