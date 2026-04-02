import { CoverageState } from '../coverage/types';

export interface CoverageTheme {
  gutterIconColor: string;
  backgroundColor: string;
  overviewRulerColor: string;
}

export const defaultTheme: Record<CoverageState, CoverageTheme> = {
  [CoverageState.Covered]: {
    gutterIconColor: '#4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    overviewRulerColor: '#4caf50',
  },
  [CoverageState.Partial]: {
    gutterIconColor: '#ff9800',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    overviewRulerColor: '#ff9800',
  },
  [CoverageState.Uncovered]: {
    gutterIconColor: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    overviewRulerColor: '#f44336',
  },
};
