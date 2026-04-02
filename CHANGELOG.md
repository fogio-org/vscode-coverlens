# Changelog

## 0.1.0

- Initial release
- Three-state coverage decoration (covered / partial branch / uncovered)
- Line-based decorations: no conflict with debugger breakpoints
- Diff mode: coverage for changed lines only (git diff)
- File tree panel with per-file percentages and thresholds
- Monorepo support: auto-detects packages from pnpm/npm workspaces
- Built-in test runner with auto-detection (Jest, Vitest, pytest, Go, Cargo, .NET)
- Local coverage history with trend delta
- Supported formats: lcov, Cobertura XML, JaCoCo XML
- File watcher: auto-reloads when coverage file changes
