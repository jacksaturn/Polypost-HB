import { describe, expect, it } from 'vitest';

import { collapseToPreview, isTextTruncated, type TruncationConfig } from './truncation';

// LinkedIn desktop-style config: 3 visible lines, ~70 chars/line, 210 char cap.
const config: TruncationConfig = {
  visibleLines: 3,
  approximateCharacters: 210,
  approximateCharactersPerLine: 70,
};

describe('collapseToPreview', () => {
  it('returns the text unchanged when it fits within the line and char budget', () => {
    const text = 'Line one\nLine two\nLine three';
    expect(collapseToPreview(text, config)).toBe(text);
  });

  it('cuts a multi-line post at the visible-line limit, not the char cap', () => {
    // Four short lines total well under 210 chars, but LinkedIn shows only three.
    const text = 'First line\nSecond line\nThird line\nFourth line should be hidden';
    const result = collapseToPreview(text, config);

    expect(result).toBe('First line\nSecond line\nThird line…');
    expect(result).not.toContain('Fourth');
  });

  it('cuts a long single paragraph at the char cap, backing off to a word boundary', () => {
    const text = `${'word '.repeat(60)}tail`; // 300+ chars, one line
    const result = collapseToPreview(text, config);

    expect(Array.from(result).length).toBeLessThanOrEqual(config.approximateCharacters + 1);
    expect(result.endsWith('…')).toBe(true);
    // No mid-word cut: the visible portion ends on a whole word.
    expect(result.slice(0, -1).trimEnd().endsWith('word')).toBe(true);
  });

  it('agrees with isTextTruncated about whether anything is hidden', () => {
    const fits = 'Short post.';
    const overflows = 'a\nb\nc\nd\ne';

    expect(isTextTruncated(fits, config)).toBe(false);
    expect(collapseToPreview(fits, config)).toBe(fits);

    expect(isTextTruncated(overflows, config)).toBe(true);
    expect(collapseToPreview(overflows, config)).not.toBe(overflows);
  });
});
