const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find((candidate) => candidate.type === 'page' && candidate.url.includes('linkedin.com'));
const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const message = { id: ++nextId, method, params };
    function handleMessage(event) {
      const data = JSON.parse(event.data);
      if (data.id !== message.id) return;
      socket.removeEventListener('message', handleMessage);
      data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
    }
    socket.addEventListener('message', handleMessage);
    socket.send(JSON.stringify(message));
  });
}

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    window.__lipfNativePostClicks = 0;
    document.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      const label = ((button?.textContent ?? '') + ' ' + (button?.getAttribute('aria-label') ?? '')).trim().toLowerCase();
      if (label === 'post' && !button?.closest('#linkedin-post-formatter-extension-root')) {
        window.__lipfNativePostClicks += 1;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }, true);
    return true;
  })()`,
  returnByValue: true,
});

const extensionPost = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const root = document.querySelector('#linkedin-post-formatter-extension-root');
    const buttons = Array.from(root?.querySelectorAll('button') ?? []);
    const button = buttons.find((candidate) => candidate.textContent?.trim() === 'Post');
    if (!button) return { found: false, buttons: buttons.map((candidate) => candidate.textContent?.trim()) };
    const rect = button.getBoundingClientRect();
    return { found: true, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), disabled: button.disabled };
  })()`,
  returnByValue: true,
});

if (!extensionPost.result.value?.found) {
  console.error(JSON.stringify(extensionPost.result.value, null, 2));
  process.exit(1);
}

await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: extensionPost.result.value.x, y: extensionPost.result.value.y, button: 'none' });
await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: extensionPost.result.value.x, y: extensionPost.result.value.y, button: 'left', clickCount: 1 });
await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: extensionPost.result.value.x, y: extensionPost.result.value.y, button: 'left', clickCount: 1 });
await new Promise((resolve) => setTimeout(resolve, 3000));

const result = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
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
  })()`,
  returnByValue: true,
});

console.log(JSON.stringify(result.result.value, null, 2));
socket.close();