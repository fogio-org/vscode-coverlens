# Changelog

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
