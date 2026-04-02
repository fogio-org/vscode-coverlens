import * as vscode from 'vscode';

export interface CoverageTheme {
  covered: vscode.DecorationRenderOptions;
  partial: vscode.DecorationRenderOptions;
  uncovered: vscode.DecorationRenderOptions;
}

/** Build theme from config or use sensible defaults */
export function buildTheme(
  style: 'border' | 'highlight',
  customColors: { covered?: string; partial?: string; uncovered?: string }
): CoverageTheme {

  const coveredSolid   = customColors.covered   || 'rgba(64, 173, 100, 0.6)';
  const partialSolid   = customColors.partial   || 'rgba(220, 170, 50, 0.6)';
  const uncoveredSolid = customColors.uncovered || 'rgba(200, 60, 60, 0.6)';

  // "border" mode: only a vertical bar on the left edge of each line
  const border: CoverageTheme = {
    covered: {
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      borderColor: coveredSolid,
      overviewRulerColor: coveredSolid,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      isWholeLine: true,
    },
    partial: {
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      borderColor: partialSolid,
      overviewRulerColor: partialSolid,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      isWholeLine: true,
    },
    uncovered: {
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      borderColor: uncoveredSolid,
      overviewRulerColor: uncoveredSolid,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      isWholeLine: true,
    },
  };

  if (style === 'border') return border;

  // "highlight" mode: vertical bar + background fill
  const coveredBg   = customColors.covered   || 'rgba(64, 173, 100, 0.18)';
  const partialBg   = customColors.partial   || 'rgba(220, 170, 50, 0.20)';
  const uncoveredBg = customColors.uncovered || 'rgba(200, 60, 60, 0.18)';

  return {
    covered: {
      ...border.covered,
      backgroundColor: coveredBg,
    },
    partial: {
      ...border.partial,
      backgroundColor: partialBg,
    },
    uncovered: {
      ...border.uncovered,
      backgroundColor: uncoveredBg,
    },
  };
}
