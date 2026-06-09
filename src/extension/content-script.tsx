import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { LinkedInComposerOverlay } from './LinkedInComposerOverlay';
import {
  findLinkedInComposer,
  findLinkedInPostButton,
  findNativeComposerDialog,
  isStartPostControl,
  openNativeLinkedInComposer,
  setLinkedInComposerText,
} from './linkedinComposer';
import './extension.css';

const ROOT_ID = 'linkedin-post-formatter-extension-root';
const DIAGNOSTIC_ATTRIBUTE = 'data-linkedin-formatter-diagnostic';
const NATIVE_HIDDEN_CLASS_NAME = 'lipf-native-composer-hidden';
const LINKEDIN_SHARE_ACTIVE_URL = 'https://www.linkedin.com/feed/?shareActive=true';

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;
let isFormatterOpen = false;
let pendingFormatterOpenRequest = 0;

function mountFormatter() {
  if (mountedContainer?.isConnected) {
    return;
  }

  const container = document.createElement('div');
  container.id = ROOT_ID;
  container.className = 'lipf-extension-root';
  container.textContent = 'LinkedIn Post Formatter loaded';
  container.setAttribute(DIAGNOSTIC_ATTRIBUTE, 'mounted');
  document.body.append(container);

  mountedContainer = container;

  try {
    mountedRoot = createRoot(container);
    renderFormatter();
  } catch (error) {
    renderMountError(container, error);
  }
}

function renderFormatter() {
  mountedRoot?.render(
    <StrictMode>
      <LinkedInComposerOverlay open={isFormatterOpen} onClose={closeFormatter} onPost={postThroughLinkedIn} />
    </StrictMode>,
  );
}

function openFormatter() {
  isFormatterOpen = true;
  hideNativeComposer();
  window.setTimeout(hideNativeComposer, 500);
  renderFormatter();
}

function scheduleFormatterOpenAfterNativeComposer() {
  const requestId = ++pendingFormatterOpenRequest;

  window.setTimeout(async () => {
    await waitForElement(() => findNativeComposerDialog() ?? findLinkedInComposer(), 2500);

    if (requestId === pendingFormatterOpenRequest) {
      openFormatter();
    }
  }, 0);
}

function closeFormatter() {
  isFormatterOpen = false;
  pendingFormatterOpenRequest += 1;
  showNativeComposer();
  closeNativeComposer();
  renderFormatter();
}

async function postThroughLinkedIn(text: string): Promise<boolean> {
  isFormatterOpen = false;
  renderFormatter();
  showNativeComposer();

  let composer = findLinkedInComposer();

  if (!composer) {
    openNativeLinkedInComposer();
    composer = await waitForLinkedInComposer();
  }

  if (!composer) {
    window.history.pushState({}, '', LINKEDIN_SHARE_ACTIVE_URL);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await wait(500);
    composer = await waitForLinkedInComposer();
  }

  if (!composer || !setLinkedInComposerText(composer, text)) {
    isFormatterOpen = true;
    renderFormatter();
    hideNativeComposer();
    return false;
  }

  const postButton = await waitForLinkedInPostButton();

  if (!postButton) {
    isFormatterOpen = true;
    renderFormatter();
    hideNativeComposer();
    return false;
  }

  postButton.click();
  return true;
}

function handleDocumentStartPostEvent(event: MouseEvent | PointerEvent) {
  const target = event.target instanceof Element ? event.target : null;

  if (!target || target.closest(`#${ROOT_ID}`)) {
    return;
  }

  const control = target.closest<HTMLElement>('button, [role="button"]');

  if (!control || !isStartPostControl(control)) {
    return;
  }

  scheduleFormatterOpenAfterNativeComposer();
}

async function waitForLinkedInComposer() {
  return waitForElement(findLinkedInComposer, 3500);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForLinkedInPostButton() {
  return waitForElement(findLinkedInPostButton, 3500);
}

function waitForElement<T extends Element>(finder: () => T | null, timeoutMs: number): Promise<T | null> {
  const found = finder();

  if (found) {
    return Promise.resolve(found);
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const current = finder();

      if (current) {
        window.clearInterval(interval);
        resolve(current);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

function hideNativeComposer() {
  const dialog = findNativeComposerDialog();

  if (!dialog) {
    return;
  }

  dialog.classList.add(NATIVE_HIDDEN_CLASS_NAME);
}

function showNativeComposer() {
  document.querySelectorAll<HTMLElement>(`.${NATIVE_HIDDEN_CLASS_NAME}`).forEach((element) => {
    element.classList.remove(NATIVE_HIDDEN_CLASS_NAME);
  });
}

function closeNativeComposer() {
  const dialog = findNativeComposerDialog();
  const closeButton = dialog?.querySelector<HTMLElement>('button[aria-label*="Close"], button[aria-label*="Dismiss"]');
  closeButton?.click();
}

function unmountFormatter() {
  mountedRoot?.unmount();
  mountedRoot = null;

  if (mountedContainer?.isConnected) {
    mountedContainer.remove();
  }

  mountedContainer = null;
}

function scheduleMount() {
  window.setTimeout(() => {
    mountFormatter();
  }, 100);
}

function renderMountError(container: HTMLElement, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown mount error';
  container.textContent = `LinkedIn Post Formatter failed to mount: ${message}`;
  container.setAttribute(DIAGNOSTIC_ATTRIBUTE, 'mount-error');
}

scheduleMount();

const observer = new MutationObserver(() => {
  scheduleMount();

  if (isFormatterOpen) {
    window.setTimeout(hideNativeComposer, 0);
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('click', handleDocumentStartPostEvent, true);
document.addEventListener('linkedin-post-formatter:open', openFormatter);

window.addEventListener('beforeunload', () => {
  observer.disconnect();
  document.removeEventListener('click', handleDocumentStartPostEvent, true);
  document.removeEventListener('linkedin-post-formatter:open', openFormatter);
  unmountFormatter();
});