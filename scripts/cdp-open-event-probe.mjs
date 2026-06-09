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
  expression: `document.dispatchEvent(new Event('linkedin-post-formatter:open')); true`,
  returnByValue: true,
});
await new Promise((resolve) => setTimeout(resolve, 1000));

const result = await call('Runtime.evaluate', {
  expression: `(() => ({
    root: document.querySelector('#linkedin-post-formatter-extension-root')?.textContent?.slice(0, 300),
    buttons: Array.from(document.querySelectorAll('#linkedin-post-formatter-extension-root button')).map((button) => button.textContent?.trim()),
    rootHtml: document.querySelector('#linkedin-post-formatter-extension-root')?.innerHTML.slice(0, 300),
  }))()`,
  returnByValue: true,
});

console.log(JSON.stringify(result.result.value, null, 2));
socket.close();