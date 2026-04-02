import * as vscode from 'vscode';

export interface CoverageTheme {
  covered: vscode.DecorationRenderOptions;
  partial: vscode.DecorationRenderOptions;   // branch partially covered
  uncovered: vscode.DecorationRenderOptions;
}

/** Build theme from config or use sensible defaults */
export function buildTheme(
  style: 'gutter' | 'line' | 'both',
  customColors: { covered?: string; partial?: string; uncovered?: string }
): CoverageTheme {

  const coveredColor   = customColors.covered   || 'rgba(64, 173, 100, 0.18)';
  const partialColor   = customColors.partial   || 'rgba(220, 170, 50, 0.20)';
  const uncoveredColor = customColors.uncovered || 'rgba(200, 60, 60, 0.18)';

  const coveredBorder   = customColors.covered   || 'rgba(64, 173, 100, 0.6)';
  const partialBorder   = customColors.partial   || 'rgba(220, 170, 50, 0.6)';
  const uncoveredBorder = customColors.uncovered || 'rgba(200, 60, 60, 0.6)';

  const line: CoverageTheme = {
    covered: {
      backgroundColor: coveredColor,
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: coveredBorder,
      overviewRulerColor: coveredBorder,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    },
    partial: {
      backgroundColor: partialColor,
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: partialBorder,
      overviewRulerColor: partialBorder,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    },
    uncovered: {
      backgroundColor: uncoveredColor,
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: uncoveredBorder,
      overviewRulerColor: uncoveredBorder,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    },
  };

  if (style === 'line') return line;

  // For 'gutter' mode: only gutter, no background
  // For 'both' mode: background + gutter
  const gutterOnly: CoverageTheme = {
    covered: {
      gutterIconPath: svgCircle('4dad64'),
      gutterIconSize: 'contain',
      overviewRulerColor: coveredBorder,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    },
    partial: {
      gutterIconPath: svgCircle('dcaa32'),
      gutterIconSize: 'contain',
      overviewRulerColor: partialBorder,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    },
    uncovered: {
      gutterIconPath: svgCircle('c83c3c'),
      gutterIconSize: 'contain',
      overviewRulerColor: uncoveredBorder,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    },
  };

  if (style === 'gutter') return gutterOnly;

  // 'both': merge
  return {
    covered:   { ...line.covered,   ...gutterOnly.covered },
    partial:   { ...line.partial,   ...gutterOnly.partial },
    uncovered: { ...line.uncovered, ...gutterOnly.uncovered },
  };
}

function svgCircle(hex: string): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="#${hex}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}
