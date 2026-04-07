# Changelog

## 0.4.0

### New Features

- **Scoped test runs** — on save, runs tests only for the affected package/directory instead of the full suite (Go, Jest, Vitest, pytest)
- **Go coverage merge** — scoped Go test runs write to a temporary profile and merge into the main `coverage.out`, preserving full project coverage
- **Status bar spinner** — animated indicator while tests are running, decorations dim automatically
- **Click status bar to run tests** — clicking the coverage % in the status bar triggers a full test suite run
- **Full test run on startup** — initial activation runs the complete test suite (when `runOnSave` is enabled)

### Bug Fixes

- Fixed Go scoped test run overwriting full `coverage.out` with partial data — overall coverage % no longer drops after editing a single package
- Fixed test failures (exit code 1) blocking coverage merge — Go tests that fail still produce valid coverage data which is now processed
- Fixed tree view thresholds not updating when `coverlens.thresholds` settings change
- Fixed tree provider EventEmitter not disposed on extension deactivation
- Fixed `runOnSave` timeout not cleared on deactivation — prevented stale callbacks on disposed runner
- Fixed watcher firing unnecessary reload on startup (`ignoreInitial` changed to `true`)
- Fixed monorepo reload failing entirely when one package has a corrupted coverage file
- Removed dead `onDidSaveTextDocument` handler in decorator

### Improvements

- Test runner abort sends SIGTERM with SIGKILL fallback after 2 seconds
- Scoped run debounce: 1 second after last save
- Runner exposes `onRunningChanged` event for UI reactivity
- `showRunnerNotifications` now defaults to `false`

## 0.3.0

### New Features

- **Stale coverage handling** — when a file is edited, coverage decorations can be hidden, dimmed, or kept (`coverlens.onEdit`: `hide` | `dim` | `keep`, default `dim`)
- **Auto-run tests on save** — automatically run tests with coverage when a file is saved (`coverlens.runOnSave`, default `true`)
- **Runner notification toggle** — option to hide progress notification while tests run (`coverlens.showRunnerNotifications`)
- **Gitignore protection** — on first test run, prompts to add coverage file patterns to `.gitignore`
- **Coverage delta in status bar** — shows how coverage changed vs session start (normal mode) or vs base branch (diff mode)
- **Branch-aware baseline** — delta baseline automatically resets when git branch changes
- **Diff mode delta** — in diff mode, delta shows how your changes affect overall project coverage

### Bug Fixes

- Fixed diff mode not filtering lines when there are no changes (showed all lines instead of none)
- Fixed status bar losing `[diff]` indicator after toggling coverage on/off
- Fixed git diff error not clearing diff mode indicator from status bar
- Fixed Cobertura and JaCoCo parsers not computing branch coverage metrics (`branchPercent`, `totalBranches`)
- Fixed shell injection vulnerability in `git diff` command — switched from `cp.exec` to `cp.execFile` with input validation

### Improvements

- Replaced file-based coverage snapshots with lightweight session baseline tracking
- Delta in diff mode compares total coverage vs coverage of unchanged lines only
- Removed `coverlens.history.enabled` and `coverlens.history.maxSnapshots` settings
- Added `coverlens.showDelta` setting to toggle delta display in status bar
- Commands renamed: "Show Coverage History" → "Show Coverage Summary", "Clear Coverage History" → "Reset Coverage Baseline"

## 0.2.0

### New Features

- Scrollbar coverage indicator with `coverlens.overviewRuler` setting (off by default)
- Istanbul JSON format support (`coverage.json`, `coverage-final.json`)
- Expanded default coverage file patterns (18 patterns)
- Smart file path resolution with glob fallback
- Tree view placeholder when no coverage data found

### Bug Fixes

- Fixed coverage not loading when `monorepo.enabled` is false
- Fixed watcher not reacting to coverage file deletion
- Fixed unhandled promise rejections in file watcher
- Fixed `clearHistory` deleting without confirmation
- Settings changes (`coverageFiles`, `excludePatterns`, `monorepo`) now auto-reload coverage
- History store no longer crashes on permission errors

### Improvements

- Display modes changed to `border` (default) and `highlight`; removed gutter mode
- Coverage history stored in VS Code global storage instead of workspace
- Fixed problem matcher for webpack watch task
- Updated icon, README, and marketplace metadata

## 0.1.1

- Update README and package.json for improved visibility and versioning
- Enhance badge display and correct repository links

## 0.1.0

### Features

- Three-state coverage visualization: covered (green), partial branches (yellow), uncovered (red)
- Two display modes: `border` (minimal left bar) and `highlight` (bar + background fill)
- No gutter icons — works alongside debugger breakpoints without conflicts
- Diff mode: show coverage only for lines changed vs a base branch (`git diff`)
- File explorer panel with per-file coverage percentages and threshold-based icons
- Status bar with project-wide coverage percentage
- Monorepo support: auto-detects pnpm/npm/yarn workspaces, aggregates coverage
- Built-in test runner with auto-detection (Jest, Vitest, pytest, Go, Cargo, .NET)
- Local coverage history with trend delta tracking
- File watcher: auto-reloads decorations when coverage files change on disk

### Supported Formats

- LCOV (Jest, Vitest, pytest-cov, cargo-tarpaulin, Coverlet)
- Istanbul JSON (Jest, NYC, c8, Vitest)
- Cobertura XML (coverage.py, Coverlet, many CI systems)
- JaCoCo XML (Java/Kotlin via Gradle or Maven)
- Go coverage profile (`go test -coverprofile`)

### Languages

- JavaScript / TypeScript
- Python
- Go
- Rust
- C# / .NET
- Java / Kotlin
