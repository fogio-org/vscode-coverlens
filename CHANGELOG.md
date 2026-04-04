# Changelog

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
