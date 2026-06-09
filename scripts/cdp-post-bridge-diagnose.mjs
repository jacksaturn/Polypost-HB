const endpoint = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222/json/list';
const targets = await (await fetch(endpoint)).json();
const target = targets.find((candidate) => candidate.type === 'page' && candidate.url.includes('linkedin.com'));

if (!target) {
  console.error('No LinkedIn page target found.');
  process.exit(1);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const message = { id: ++nextId, method, params };

    function handleMessage(event) {
      const data = JSON.parse(event.data);

      if (data.id !== message.id) {
        return;
      }

      socket.removeEventListener('message', handleMessage);
      data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
    }

    socket.addEventListener('message', handleMessage);
    socket.send(JSON.stringify(message));
  });
}

async function evaluate(expression) {
  let lastError;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await call('Runtime.evaluate', { expression, returnByValue: true });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const draft = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Bridge Test' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'This should reach LinkedIn.' }] },
  ],
};

await evaluate(`(() => {
    localStorage.setItem('linkedin-format:draft-v1', ${JSON.stringify(JSON.stringify(draft))});
    localStorage.removeItem('linkedin-format:draft-history-v1');
    return true;
  })()`);

await call('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 3000));

for (let attempt = 0; attempt < 20; attempt += 1) {
  const root = await evaluate(String.raw`Boolean(document.querySelector('#linkedin-post-formatter-extension-root'))`);

  if (root.result.value) {
    break;
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
}

await evaluate(String.raw`(() => {
  window.__lipfNativePostClicks = 0;
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    const label = ((button?.textContent ?? '') + ' ' + (button?.getAttribute('aria-label') ?? '')).trim().toLowerCase();
    if (label === 'post') {
      window.__lipfNativePostClicks += 1;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);
  document.dispatchEvent(new Event('linkedin-post-formatter:open'));
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 1000));

const extensionPost = await evaluate(String.raw`(() => {
    const root = document.querySelector('#linkedin-post-formatter-extension-root');
    const button = Array.from(root?.querySelectorAll('button') ?? []).find((candidate) => candidate.textContent?.trim() === 'Post');
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), disabled: button.disabled };
  })()`);

if (!extensionPost.result.value) {
  console.error('Extension Post button not found.');
  process.exit(1);
}

await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: extensionPost.result.value.x, y: extensionPost.result.value.y, button: 'none' });
await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: extensionPost.result.value.x, y: extensionPost.result.value.y, button: 'left', clickCount: 1 });
await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: extensionPost.result.value.x, y: extensionPost.result.value.y, button: 'left', clickCount: 1 });
await new Promise((resolve) => setTimeout(resolve, 2500));

const result = await evaluate(String.raw`(() => {
    const nativeComposers = Array.from(document.querySelectorAll('[contenteditable="true"]')).filter((element) => !element.closest('#linkedin-post-formatter-extension-root')).map((element) => ({
      ariaLabel: element.getAttribute('aria-label'),
      className: String(element.className),
      text: element.textContent,
      visible: !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length),
      dialogText: element.closest('[role="dialog"]')?.textContent?.slice(0, 200),
    }));
    const nativeButtons = Array.from(document.querySelectorAll('[role="dialog"] button')).map((button) => ({
      text: button.textContent?.trim(),
      ariaLabel: button.getAttribute('aria-label'),
      disabled: button.disabled,
      ariaDisabled: button.getAttribute('aria-disabled'),
    }));
    return {
      extensionRootText: document.querySelector('#linkedin-post-formatter-extension-root')?.textContent?.slice(0, 300),
      nativeComposers,
      nativeButtons,
      nativePostClicks: window.__lipfNativePostClicks ?? 0,
    };
  })()`);

console.log(JSON.stringify(result.result.value, null, 2));
socket.close();