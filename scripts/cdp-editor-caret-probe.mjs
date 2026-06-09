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

const before = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const editor = document.querySelector('.rich-editor-content');

    if (!editor) {
      return { found: false };
    }

    const rect = editor.getBoundingClientRect();
    return {
      found: true,
      point: {
        x: Math.round(rect.left + Math.min(80, rect.width / 2)),
        y: Math.round(rect.top + Math.min(80, rect.height / 2)),
      },
      activeBefore: document.activeElement === editor,
      textBefore: editor.textContent,
    };
  })()`,
  returnByValue: true,
});

const point = before.result.value.point;

if (point) {
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const after = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const editor = document.querySelector('.rich-editor-content');
    const selection = window.getSelection();

    return {
      activeAfter: document.activeElement === editor,
      anchorInsideEditor: Boolean(selection?.anchorNode && editor?.contains(selection.anchorNode)),
      focusInsideEditor: Boolean(selection?.focusNode && editor?.contains(selection.focusNode)),
      selectionCollapsed: selection?.isCollapsed ?? null,
      textAfter: editor?.textContent,
      hitElement: (() => {
        if (!editor) return null;
        const rect = editor.getBoundingClientRect();
        const element = document.elementFromPoint(rect.left + Math.min(80, rect.width / 2), rect.top + Math.min(80, rect.height / 2));
        return element ? { tag: element.tagName, className: String(element.className), text: element.textContent?.slice(0, 80) } : null;
      })(),
    };
  })()`,
  returnByValue: true,
});

console.log(JSON.stringify({ before: before.result.value, after: after.result.value }, null, 2));
socket.close();