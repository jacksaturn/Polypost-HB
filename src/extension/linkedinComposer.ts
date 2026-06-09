const COMPOSER_SELECTORS = [
  'div[role="dialog"] .ql-editor[contenteditable="true"]',
  'div[role="dialog"] [contenteditable="true"][aria-label]',
  '.share-box [contenteditable="true"]',
  '.share-box-v2__modal [contenteditable="true"]',
  '.share-creation-state__content [contenteditable="true"]',
  '[contenteditable="true"]',
];

export function findLinkedInComposer(root: ParentNode = document): HTMLElement | null {
  for (const selector of COMPOSER_SELECTORS) {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector));
    const composer = candidates.find(isUsableComposer);

    if (composer) {
      return composer;
    }
  }

  return null;
}

export function getLinkedInComposerAnchor(composer: HTMLElement): HTMLElement {
  return composer.closest<HTMLElement>('.ql-container') ?? composer.parentElement ?? composer;
}

export function findNativeComposerDialog(root: ParentNode = document): HTMLElement | null {
  const composer = findLinkedInComposer(root);

  if (composer) {
    return composer.closest<HTMLElement>('[role="dialog"]');
  }

  return Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"]')).find((dialog) => {
    const text = (dialog.textContent ?? '').toLowerCase();
    return text.includes('post to anyone') || text.includes('what do you want to talk about') || text.includes('strengthen post');
  }) ?? null;
}

export function findLinkedInPostButton(root: ParentNode = document): HTMLButtonElement | null {
  const dialog = findNativeComposerDialog(root) ?? root;
  const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));

  return buttons.find((button) => {
    const label = `${button.textContent ?? ''} ${button.getAttribute('aria-label') ?? ''}`.trim().toLowerCase();
    return !button.disabled && /^post$/.test(label);
  }) ?? null;
}

export function isStartPostControl(element: HTMLElement): boolean {
  const label = `${element.textContent ?? ''} ${element.getAttribute('aria-label') ?? ''}`.toLowerCase();
  return label.includes('start a post');
}

export function openNativeLinkedInComposer(): boolean {
  const control = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).find(isStartPostControl);
  control?.click();
  return Boolean(control);
}

export function setLinkedInComposerText(composer: HTMLElement, text: string): boolean {
  if (!composer.isConnected || composer.getAttribute('contenteditable') !== 'true') {
    return false;
  }

  composer.focus();
  selectComposerContents(composer);
  composer.dispatchEvent(createInputEvent(text, 'beforeinput'));

  if (typeof document.execCommand !== 'function' || !document.execCommand('insertText', false, text)) {
    composer.textContent = text;
  }

  composer.dispatchEvent(createInputEvent(text, 'input'));
  composer.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  composer.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function isUsableComposer(composer: HTMLElement): boolean {
  if (!composer.isConnected || composer.closest('#linkedin-post-formatter-extension-root')) {
    return false;
  }

  const rect = composer.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const labels = [
    composer.getAttribute('aria-label'),
    composer.getAttribute('data-placeholder'),
    composer.textContent,
    composer.closest('[role="dialog"]')?.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (labels.includes('what do you want to talk about')) {
    return true;
  }

  return Boolean(composer.closest('[role="dialog"]') || composer.closest('.share-box, .share-box-v2__modal, .share-creation-state__content'));
}

function createInputEvent(text: string, type: 'beforeinput' | 'input'): Event {
  if (typeof InputEvent === 'function') {
    return new InputEvent(type, { bubbles: true, cancelable: type === 'beforeinput', data: text, inputType: 'insertText' });
  }

  return new Event(type, { bubbles: true, cancelable: type === 'beforeinput' });
}

function selectComposerContents(composer: HTMLElement) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  selection?.removeAllRanges();
  selection?.addRange(range);
}