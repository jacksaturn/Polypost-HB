// Generic "see more" cutoff estimation shared by every platform's feed
// preview. The LinkedIn-specific configs live in feedPreview.ts; per-platform
// configs live on each PlatformSpec.
export type PreviewMode = 'desktop' | 'mobile';

export interface TruncationConfig {
  visibleLines: number;
  approximateCharacters: number;
  approximateCharactersPerLine: number;
}

export function isTextTruncated(text: string, config: TruncationConfig): boolean {
  const normalized = text.replace(/\r\n?/g, '\n').trimEnd();

  if (!normalized.trim()) {
    return false;
  }

  return (
    countApproximateLines(normalized, config.approximateCharactersPerLine) > config.visibleLines ||
    Array.from(normalized).length > config.approximateCharacters
  );
}

function countApproximateLines(text: string, approximateCharactersPerLine: number): number {
  return text.split('\n').reduce((lineCount, line) => {
    if (!line.trim()) {
      return lineCount + 1;
    }

    return lineCount + Math.max(1, Math.ceil(Array.from(line).length / approximateCharactersPerLine));
  }, 0);
}

// The visible portion before "…more", matching the feed's "show N lines, then
// cut" behavior: stop at whichever comes first — `visibleLines` visual lines
// (explicit newlines plus wraps at `approximateCharactersPerLine`) or
// `approximateCharacters`. A mid-line cut backs off to a word boundary; a cut
// that lands on a newline keeps the whole last line. Returns the original text
// when nothing is hidden.
export function collapseToPreview(text: string, config: TruncationConfig): string {
  const normalized = text.replace(/\r\n?/g, '\n');
  const chars = Array.from(normalized);

  let lines = 0;
  let column = 0;
  let cut = chars.length;

  for (let i = 0; i < chars.length; i += 1) {
    if (i >= config.approximateCharacters) {
      cut = i;
      break;
    }

    if (chars[i] === '\n') {
      lines += 1;
      column = 0;
    } else {
      column += 1;

      if (column > config.approximateCharactersPerLine) {
        // This character wrapped onto a new visual line.
        lines += 1;
        column = 1;
      }
    }

    if (lines >= config.visibleLines) {
      cut = i + 1;
      break;
    }
  }

  if (cut >= chars.length) {
    return text;
  }

  const cutOnNewline = cut > 0 && chars[cut - 1] === '\n';
  let slice = chars.slice(0, cut).join('').replace(/\s+$/u, '');

  if (!cutOnNewline) {
    const lastSpace = slice.lastIndexOf(' ');

    if (lastSpace > slice.length * 0.6) {
      slice = slice.slice(0, lastSpace).replace(/\s+$/u, '');
    }
  }

  return `${slice}…`;
}
