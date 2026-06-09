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
    editor.focus();

    return {
      found: true,
      active: document.activeElement === editor,
      rect: {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + Math.min(60, rect.height / 2)),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      text: editor.textContent,
    };
  })()`,
  returnByValue: true,
});

const point = before.result.value.rect;

if (point) {
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await call('Input.insertText', { text: 'Focus probe' });
}

const after = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const editor = document.querySelector('.rich-editor-content');

    return {
      active: document.activeElement === editor,
      text: editor?.textContent,
      rootText: document.querySelector('#linkedin-post-formatter-extension-root')?.textContent?.slice(0, 260),
    };
  })()`,
  returnByValue: true,
});

console.log(JSON.stringify({ before: before.result.value, after: after.result.value }, null, 2));
socket.close();