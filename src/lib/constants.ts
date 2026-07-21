export const APP_NAME = 'Polypost @ High Bias';

export const LINKEDIN_POST_CHARACTER_LIMIT = 3000;
export const LINKEDIN_POST_WARNING_THRESHOLD = 2800;

export type CharacterCountStatus = 'normal' | 'warning' | 'over';

// Warn when within this many characters of the limit, in addition to each
// platform's own warning threshold.
export const WARNING_MARGIN = 50;

// Generalized for any platform. Defaults reproduce the original LinkedIn-only
// behavior for callers that pass just a count.
export function getCharacterCountStatus(
  count: number,
  limit: number = LINKEDIN_POST_CHARACTER_LIMIT,
  warningThreshold: number = LINKEDIN_POST_WARNING_THRESHOLD,
): CharacterCountStatus {
  if (count > limit) {
    return 'over';
  }

  if (count >= warningThreshold || limit - count <= WARNING_MARGIN) {
    return 'warning';
  }

  return 'normal';
}
