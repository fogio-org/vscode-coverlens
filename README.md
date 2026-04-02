# CoverLens

> **See through your tests** — three-state coverage lens with diff mode and monorepo support

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/coverlens.coverlens)](https://marketplace.visualstudio.com/items?itemName=coverlens.coverlens)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/coverlens.coverlens)](https://marketplace.visualstudio.com/items?itemName=coverlens.coverlens)

## What makes CoverLens different

| Feature | Coverage Gutters | CoverLens |
|---|---|---|
| Three coverage states (covered / partial branch / uncovered) | ✗ (binary) | ✓ |
| Works alongside debugger breakpoints | ✗ (gutter conflict) | ✓ |
| Diff mode (coverage for changed lines only) | ✗ | ✓ |
| Monorepo: multiple coverage files | ✗ | ✓ |
| Built-in test runner | ✗ | ✓ |
| Local coverage history & trends | ✗ | ✓ |
| Auto-detects lcov, Cobertura, JaCoCo | partial | ✓ |

## Getting started

1. Install CoverLens from the Marketplace
2. Generate a coverage file with your test runner:
   - **Jest**: `npx jest --coverage --coverageReporters=lcov`
   - **pytest**: `python -m pytest --cov=. --cov-report=lcov:lcov.info`
   - **Go**: `go test ./... -coverprofile=coverage.out`
   - **Rust**: `cargo tarpaulin --out Lcov`
3. Open a source file — coverage appears automatically

Or use **CoverLens: Run Tests with Coverage** from the Command Palette to do it all in one click.

## Three coverage states

- 🟢 **Green** — line executed, all branches covered
- 🟡 **Yellow** — line executed, but some branches not taken (partial branch coverage)
- 🔴 **Red** — line never executed

This is the key improvement over binary coverage tools.

## Diff mode

Run `CoverLens: Toggle Diff Mode` to show coverage **only on lines you changed**
(uses `git diff HEAD`). Perfect for code review — focus on what matters right now.

Configure the base branch:
```json
"coverlens.diffBase": "origin/main"
```

## Monorepo support

CoverLens automatically detects packages from `pnpm-workspace.yaml` and `package.json`
workspaces, then aggregates coverage from all packages into one unified view.

## Settings

| Setting | Default | Description |
|---|---|---|
| `coverlens.enabled` | `true` | Enable on startup |
| `coverlens.coverageFiles` | `["**/lcov.info", ...]` | Glob patterns for coverage files |
| `coverlens.decorationStyle` | `"line"` | `"line"`, `"gutter"`, or `"both"` |
| `coverlens.diffMode` | `false` | Show coverage only for changed lines |
| `coverlens.diffBase` | `"HEAD"` | Base ref for diff mode |
| `coverlens.testRunner` | `"auto"` | `jest`, `vitest`, `pytest`, `go`, `cargo`, `dotnet`, `custom` |
| `coverlens.monorepo.enabled` | `true` | Auto-detect monorepo packages |
| `coverlens.thresholds.low` | `50` | Below this % → red in tree |
| `coverlens.thresholds.medium` | `80` | Below this % → yellow in tree |
| `coverlens.history.enabled` | `true` | Track coverage trends locally |

## Commands

| Command | Description |
|---|---|
| `CoverLens: Toggle Coverage` | Show/hide all decorations |
| `CoverLens: Toggle Diff Mode` | Switch to changed-lines-only view |
| `CoverLens: Run Tests with Coverage` | Run tests and reload coverage |
| `CoverLens: Reload Coverage Files` | Manually reload from disk |
| `CoverLens: Show Coverage History` | Display trend summary |

## Supported formats

- **lcov** (`.info`) — Jest, pytest-cov, Go, Rust/tarpaulin
- **Cobertura** (`.xml`) — Python coverage.py, .NET coverlet, many CI systems
- **JaCoCo** (`.xml`) — Java/Kotlin (Gradle, Maven)

## License

MIT
