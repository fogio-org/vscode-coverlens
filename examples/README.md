# CoverLens Examples

Test projects for verifying coverage visualization across all supported languages and formats.

## Quick Start

Use the launch configurations in the root `.vscode/launch.json`:

1. **Run Extension (JS Example)** — opens `js-jest/` folder with pre-generated coverage
2. **Run Extension (Go Example)** — opens `go/` folder with pre-generated coverage
3. **Run Extension (All Examples)** — opens multi-root workspace with all 7 examples

Or manually: press F5 with "Run Extension", then in the Extension Development Host open any example folder.

## Examples

| Folder | Language | Format | Coverage File |
|---|---|---|---|
| `js-jest/` | JavaScript | LCOV | `coverage/lcov.info` |
| `ts-vitest/` | TypeScript | LCOV | `coverage/lcov.info` |
| `python-pytest/` | Python | LCOV | `lcov.info` |
| `go/` | Go | Go profile | `coverage.out` |
| `rust-cargo/` | Rust | LCOV | `lcov.info` |
| `dotnet/` | C# | LCOV + Cobertura | `lcov.info`, `coverage.cobertura.xml` |
| `java-jacoco/` | Java | JaCoCo XML | `jacoco.xml` |

## What to look for

Each example intentionally leaves some code untested:

- **Green** — fully covered lines
- **Yellow** — partial branch coverage (some branches not taken)
- **Red** — uncovered lines (no tests hit this code)

## Regenerating coverage

To regenerate coverage from actual test runs:

```bash
# JavaScript (Jest)
cd js-jest && npx jest --coverage --coverageReporters=lcov

# TypeScript (Vitest)
cd ts-vitest && npx vitest run --coverage --coverage.reporter=lcov

# Python
cd python-pytest && python -m pytest --cov=. --cov-report=lcov:lcov.info

# Go
cd go && go test ./... -coverprofile=coverage.out

# Rust
cd rust-cargo && cargo tarpaulin --out Lcov --output-dir .

# .NET
cd dotnet && dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=lcov
```
