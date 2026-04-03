# CoverLens

> **Three-state code coverage visualization** for VS Code — see covered, partially covered, and uncovered lines at a glance.

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/coverlens.coverlens)](https://marketplace.visualstudio.com/items?itemName=coverlens.coverlens)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/coverlens.coverlens)](https://marketplace.visualstudio.com/items?itemName=coverlens.coverlens)

---

## Features

- **Three coverage states** — covered (green), partial branches (yellow), uncovered (red)
- **Two display modes** — minimal left border or border + background highlight
- **No gutter conflicts** — uses line decorations instead of gutter icons, so coverage display never interferes with debugger breakpoints
- **Diff mode** — show coverage only on lines changed vs a base branch
- **Built-in test runner** — run tests with coverage in one click
- **Monorepo support** — auto-detects pnpm/npm/yarn workspaces, aggregates coverage
- **Coverage history** — tracks trends locally across test runs
- **Explorer panel** — tree view with per-file coverage percentages and threshold icons
- **Status bar** — project-wide coverage percentage always visible
- **Auto-reload** — watches coverage files and updates decorations on change

## Supported Languages & Formats

| Language | Test Runner | Coverage Format |
|---|---|---|
| JavaScript / TypeScript | Jest, Vitest | LCOV, Istanbul JSON |
| Python | pytest | LCOV, Cobertura XML |
| Go | go test | Go coverage profile |
| Rust | cargo-tarpaulin | LCOV |
| C# / .NET | dotnet test + Coverlet | LCOV, Cobertura XML |
| Java / Kotlin | Gradle, Maven | JaCoCo XML |

Auto-detects format by file content — works with any tool that outputs a supported format.

## Getting Started

1. **Install** CoverLens from the Marketplace
2. **Generate coverage** with your test runner:

```bash
# JavaScript (Jest)
npx jest --coverage

# TypeScript (Vitest)
npx vitest run --coverage

# Python
python -m pytest --cov=. --cov-report=lcov:lcov.info

# Go
go test ./... -coverprofile=coverage.out

# Rust
cargo tarpaulin --out Lcov

# .NET
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=lcov
```

3. **Open a source file** — coverage appears automatically

Or use **CoverLens: Run Tests with Coverage** (`Cmd+Shift+P`) to generate coverage and visualize in one step.

## Coverage States

| State | Color | Meaning |
|---|---|---|
| Covered | Green | Line executed, all branches taken |
| Partial | Yellow | Line executed, but some branches not taken |
| Uncovered | Red | Line never executed |

Most coverage tools only show binary covered/uncovered. CoverLens shows **partial branch coverage** as a distinct state — helping you find untested edge cases.

## Display Modes

### Border mode (default)

Minimal vertical bar on the left edge — clean, non-intrusive, works great with any theme.

![Border mode](assets/screenshot-border.png)

### Highlight mode

Vertical bar + background fill — maximum visibility for reviewing coverage.

![Highlight mode](assets/screenshot-highlight.png)

Set via `coverlens.decorationStyle`. Both modes use line decorations (not gutter icons), so they **never conflict with debugger breakpoints** — you can set breakpoints freely while coverage is visible.

## Diff Mode

Focus on what matters during code review — show coverage **only on lines you changed**.

```
CoverLens: Toggle Diff Mode
```

Uses `git diff` against a configurable base ref:

```json
"coverlens.diffBase": "origin/main"
```

## Monorepo Support

CoverLens automatically detects packages from:
- `pnpm-workspace.yaml`
- `package.json` workspaces (npm/yarn)

Coverage from all packages is aggregated into one unified view. Configure manually if needed:

```json
"coverlens.monorepo.packages": ["packages/*", "apps/*"]
```

## Commands

| Command | Description |
|---|---|
| CoverLens: Toggle Coverage | Show or hide coverage decorations |
| CoverLens: Toggle Diff Mode | Switch between all-lines and changed-lines view |
| CoverLens: Run Tests with Coverage | Execute test runner and reload coverage |
| CoverLens: Reload Coverage Files | Re-read coverage files from disk |
| CoverLens: Show Coverage History | Display trend summary (latest %, delta) |
| CoverLens: Clear Coverage History | Delete all stored snapshots |

## Settings

| Setting | Default | Description |
|---|---|---|
| `coverlens.enabled` | `true` | Enable coverage visualization on startup |
| `coverlens.coverageFiles` | `["**/lcov.info", ...]` | Glob patterns to find coverage files |
| `coverlens.excludePatterns` | `["**/node_modules/**", ...]` | Patterns to exclude from search |
| `coverlens.decorationStyle` | `"border"` | Display mode: `"border"` or `"highlight"` |
| `coverlens.colors.covered` | — | Custom color for covered lines |
| `coverlens.colors.partial` | — | Custom color for partial branch lines |
| `coverlens.colors.uncovered` | — | Custom color for uncovered lines |
| `coverlens.diffMode` | `false` | Show coverage only for changed lines |
| `coverlens.diffBase` | `"HEAD"` | Git ref for diff mode comparison |
| `coverlens.testRunner` | `"auto"` | Test runner: `auto`, `jest`, `vitest`, `pytest`, `go`, `cargo`, `dotnet`, `custom` |
| `coverlens.testRunner.customCommand` | — | Custom shell command for test runner |
| `coverlens.monorepo.enabled` | `true` | Auto-detect monorepo packages |
| `coverlens.monorepo.packages` | `[]` | Manual package glob patterns |
| `coverlens.thresholds.low` | `50` | Below this % coverage → red icon in tree |
| `coverlens.thresholds.medium` | `80` | Below this % coverage → yellow icon in tree |
| `coverlens.history.enabled` | `true` | Track coverage snapshots locally |
| `coverlens.history.maxSnapshots` | `50` | Max number of stored snapshots |

## Default Coverage File Patterns

CoverLens searches for these files automatically:

```
**/lcov.info                    LCOV (Jest, Vitest, pytest, tarpaulin, Coverlet)
**/coverage.lcov                LCOV (alternative name)
**/coverage.xml                 Cobertura XML (coverage.py, Coverlet)
**/coverage.cobertura.xml       Cobertura XML (.NET)
**/jacoco.xml                   JaCoCo XML (Java/Kotlin)
**/target/site/jacoco/jacoco.xml  JaCoCo XML (Maven default)
**/coverage.out                 Go coverage profile
**/*.coverprofile               Go coverage profile (alternative)
**/coverage.json                Istanbul JSON (Jest, NYC, c8)
**/coverage-final.json          Istanbul JSON (NYC default)
```

Add custom patterns in settings if your tool outputs to a different path.

## License

MIT
