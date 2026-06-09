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

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const documentJson = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Selectable Heading' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Selectable paragraph text for drag testing.' }] },
  ],
};

await call('Runtime.evaluate', {
  expression: `(() => {
    localStorage.setItem('linkedin-format:draft-v1', ${JSON.stringify(JSON.stringify(documentJson))});
    return true;
  })()`,
  returnByValue: true,
});

await call('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 5000));

const startPost = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const control = Array.from(document.querySelectorAll('button, [role="button"]')).find((element) => /start a post/i.test((element.textContent ?? '') + ' ' + (element.getAttribute('aria-label') ?? '')));
    if (!control) return null;
    const rect = control.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`,
  returnByValue: true,
});

if (!startPost.result.value) {
  console.error('Start a post control not found.');
  process.exit(1);
}

await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startPost.result.value.x, y: startPost.result.value.y, button: 'none' });
await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: startPost.result.value.x, y: startPost.result.value.y, button: 'left', clickCount: 1 });
await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startPost.result.value.x, y: startPost.result.value.y, button: 'left', clickCount: 1 });
await new Promise((resolve) => setTimeout(resolve, 1000));

const points = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const paragraph = Array.from(document.querySelectorAll('.rich-editor-content p')).find((element) => element.textContent?.includes('Selectable paragraph'));
    if (!paragraph) return null;
    const rect = paragraph.getBoundingClientRect();
    return {
      startX: Math.round(rect.left + 8),
      startY: Math.round(rect.top + rect.height / 2),
      endX: Math.round(rect.left + Math.min(rect.width - 8, 250)),
      endY: Math.round(rect.top + rect.height / 2),
      text: paragraph.textContent,
    };
  })()`,
  returnByValue: true,
});

if (!points.result.value) {
  console.error('Selectable paragraph not found.');
  process.exit(1);
}

const { startX, startY, endX, endY } = points.result.value;
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: startY, button: 'none' });
await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 });
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: endX, y: endY, button: 'left' });
await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: endY, button: 'left', clickCount: 1 });
await new Promise((resolve) => setTimeout(resolve, 150));

const result = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const editor = document.querySelector('.rich-editor-content');
    const selection = window.getSelection();
    return {
      selectedText: selection?.toString() ?? '',
      anchorInsideEditor: Boolean(selection?.anchorNode && editor?.contains(selection.anchorNode)),
      focusInsideEditor: Boolean(selection?.focusNode && editor?.contains(selection.focusNode)),
      selectionCollapsed: selection?.isCollapsed ?? null,
      userSelect: editor ? getComputedStyle(editor).userSelect : null,
    };
  })()`,
  returnByValue: true,
});

console.log(JSON.stringify({ points: points.result.value, result: result.result.value }, null, 2));

if (!result.result.value.selectedText || !result.result.value.anchorInsideEditor || !result.result.value.focusInsideEditor) {
  process.exit(1);
}

socket.close();