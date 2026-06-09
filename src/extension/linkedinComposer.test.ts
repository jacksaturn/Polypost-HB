import { describe, expect, it, vi } from 'vitest';

import { findLinkedInComposer, getLinkedInComposerAnchor, setLinkedInComposerText } from './linkedinComposer';

function mockVisible(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: 160,
    height: 120,
    left: 0,
    right: 480,
    top: 40,
    width: 480,
    x: 0,
    y: 40,
    toJSON: () => ({}),
  });
}

describe('linkedinComposer helpers', () => {
  it('finds a visible LinkedIn modal composer', () => {
    document.body.innerHTML = `
      <div role="dialog">
        <div class="ql-container">
          <div class="ql-editor" contenteditable="true" data-placeholder="What do you want to talk about?"></div>
        </div>
      </div>
    `;
    const editor = document.querySelector<HTMLElement>('.ql-editor');
    expect(editor).not.toBeNull();
    mockVisible(editor!);

    expect(findLinkedInComposer()).toBe(editor);
    expect(getLinkedInComposerAnchor(editor!)).toBe(document.querySelector('.ql-container'));
  });

  it('ignores hidden composer candidates', () => {
    document.body.innerHTML = `
      <div role="dialog">
        <div class="ql-editor" contenteditable="true" data-placeholder="What do you want to talk about?"></div>
      </div>
    `;

    expect(findLinkedInComposer()).toBeNull();
  });

  it('finds a visible composer by placeholder text outside a dialog', () => {
    document.body.innerHTML = `
      <div class="share-box">
        <div contenteditable="true">What do you want to talk about?</div>
      </div>
    `;
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]');
    expect(editor).not.toBeNull();
    mockVisible(editor!);

    expect(findLinkedInComposer()).toBe(editor);
  });

  it('writes text and dispatches input and change events', () => {
    document.body.innerHTML = '<div contenteditable="true"></div>';
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]');
    expect(editor).not.toBeNull();
    const inputHandler = vi.fn();
    const changeHandler = vi.fn();
    editor!.addEventListener('input', inputHandler);
    editor!.addEventListener('change', changeHandler);

    expect(setLinkedInComposerText(editor!, 'Hello\nLinkedIn')).toBe(true);

    expect(editor!.textContent).toBe('Hello\nLinkedIn');
    expect(inputHandler).toHaveBeenCalledTimes(1);
    expect(changeHandler).toHaveBeenCalledTimes(1);
  });
});