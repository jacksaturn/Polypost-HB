const endpoint = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222/json/list';
const targets = await (await fetch(endpoint)).json();
const target = targets.find((candidate) => candidate.type === 'page' && candidate.url.includes('linkedin.com'));

if (!target) {
  console.error('No LinkedIn page target found.');
  process.exit(1);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const events = [];

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

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.method === 'Runtime.consoleAPICalled') {
    events.push({
      type: 'console',
      level: data.params.type,
      text: data.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '),
    });
  }

  if (data.method === 'Runtime.exceptionThrown') {
    events.push({
      type: 'exception',
      text: data.params.exceptionDetails.text,
      description: data.params.exceptionDetails.exception?.description,
      url: data.params.exceptionDetails.url,
      lineNumber: data.params.exceptionDetails.lineNumber,
      columnNumber: data.params.exceptionDetails.columnNumber,
    });
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

await call('Runtime.enable');
await call('Page.enable');
await call('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 5000));

const result = await call('Runtime.evaluate', {
  expression: String.raw`({
    boot: !!document.querySelector('#linkedin-post-formatter-boot-marker'),
    root: !!document.querySelector('#linkedin-post-formatter-extension-root'),
    href: location.href,
    title: document.title,
  })`,
  returnByValue: true,
});

console.log(JSON.stringify({ state: result.result.value, events }, null, 2));
socket.close();