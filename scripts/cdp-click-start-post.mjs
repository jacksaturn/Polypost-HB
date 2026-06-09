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

const expression = String.raw`(() => {
  const elements = Array.from(document.querySelectorAll('button, [role="button"]'));
  const startPost = elements.find((element) => /start a post/i.test(element.textContent ?? '') || /start a post/i.test(element.getAttribute('aria-label') ?? ''));

  if (!startPost) {
    return { clicked: false, buttons: elements.slice(0, 40).map((element) => ({ ariaLabel: element.getAttribute('aria-label'), text: element.textContent?.trim().slice(0, 80) })) };
  }

  startPost.click();
  return { clicked: true, label: startPost.getAttribute('aria-label'), text: startPost.textContent?.trim() };
})()`;

const result = await call('Runtime.evaluate', { expression, returnByValue: true });
console.log(JSON.stringify(result.result.value, null, 2));
socket.close();