import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PRESETS, clearDetectCache, detectRunner } from '../runner/presets';

let tmpRoot: string;

beforeEach(() => {
  clearDetectCache();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverlens-presets-'));
});

afterEach(() => {
  clearDetectCache();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const full = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('detectRunner picks flutter when pubspec depends on flutter SDK', async () => {
  writeFile('pubspec.yaml', `
name: demo
dependencies:
  flutter:
    sdk: flutter
`);
  await expect(detectRunner(tmpRoot)).resolves.toBe('flutter');
});

test('detectRunner picks dart for a plain Dart package', async () => {
  writeFile('pubspec.yaml', `
name: demo
environment:
  sdk: ">=3.0.0 <4.0.0"
`);
  await expect(detectRunner(tmpRoot)).resolves.toBe('dart');
});

test('detectRunner picks flutter even when an SDK constraint is also present', async () => {
  writeFile('pubspec.yaml', `
name: demo
environment:
  sdk: ">=3.0.0 <4.0.0"
dependencies:
  flutter:
    sdk: flutter
`);
  await expect(detectRunner(tmpRoot)).resolves.toBe('flutter');
});

test('flutter preset writes LCOV to coverage/lcov.info', () => {
  expect(PRESETS.flutter.outputGlob).toBe('coverage/lcov.info');
  expect(PRESETS.flutter.argv).toEqual(['flutter', 'test', '--coverage']);
});

test('dart preset formats raw coverage to LCOV with non-deprecated flags', () => {
  expect(PRESETS.dart.followUpArgv).toEqual([
    'dart', 'run', 'coverage:format_coverage',
    '--lcov',
    '--in=coverage',
    '--out=coverage/lcov.info',
    '--report-on=lib',
    '--package=.'
  ]);
});

test('dart scoped run falls back to the test/ directory when editing lib/', () => {
  const scoped = PRESETS.dart.scoped!('lib/src');
  expect(scoped.argv).toEqual(['dart', 'test', '--coverage=coverage', 'test']);
  expect(scoped.followUpArgv).toEqual(PRESETS.dart.followUpArgv);
});

test('flutter scoped run targets the saved test directory', () => {
  const scoped = PRESETS.flutter.scoped!('test/widgets');
  expect(scoped.argv).toEqual(['flutter', 'test', '--coverage', 'test/widgets']);
});

test('flutter scoped run falls back to test/ when editing lib/', () => {
  const scoped = PRESETS.flutter.scoped!('lib');
  expect(scoped.argv).toEqual(['flutter', 'test', '--coverage', 'test']);
});

test('scoped target does not treat a "testutils" sibling as the test directory', () => {
  const scoped = PRESETS.dart.scoped!('testutils/helpers');
  expect(scoped.argv).toEqual(['dart', 'test', '--coverage=coverage', 'test']);
});
