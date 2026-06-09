const endpoint = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222/json/list';
const expectedText = process.env.EDITOR_ASSERT_TEXT ?? 'Typed from automation';
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

const targetPoint = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const editor = document.querySelector('.rich-editor-content');

    if (!editor) {
      return null;
    }

    const rect = editor.getBoundingClientRect();
    return {
      x: Math.round(rect.left + 72),
      y: Math.round(rect.top + 72),
      before: editor.textContent,
      height: Math.round(rect.height),
      width: Math.round(rect.width),
    };
  })()`,
  returnByValue: true,
});

if (!targetPoint.result.value) {
  console.error('Formatter editor not found.');
  process.exit(1);
}

const { x, y } = targetPoint.result.value;
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
await new Promise((resolve) => setTimeout(resolve, 150));
await call('Input.insertText', { text: expectedText });
await new Promise((resolve) => setTimeout(resolve, 150));

const result = await call('Runtime.evaluate', {
  expression: `(() => {
    const editor = document.querySelector('.rich-editor-content');
    const selection = window.getSelection();
    return {
      activeElementTag: document.activeElement?.tagName,
      activeElementClass: String(document.activeElement?.className ?? ''),
      anchorInsideEditor: Boolean(selection?.anchorNode && editor?.contains(selection.anchorNode)),
      focusInsideEditor: Boolean(selection?.focusNode && editor?.contains(selection.focusNode)),
      text: editor?.textContent ?? '',
      hasExpectedText: (editor?.textContent ?? '').includes(${JSON.stringify(expectedText)}),
    };
  })()`,
  returnByValue: true,
});

console.log(JSON.stringify({ point: targetPoint.result.value, result: result.result.value }, null, 2));

if (!result.result.value.hasExpectedText) {
  process.exit(1);
}

socket.close();