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

      if (data.error) {
        reject(new Error(JSON.stringify(data.error)));
      } else {
        resolve(data.result);
      }
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
  const boot = document.querySelector('#linkedin-post-formatter-boot-marker');
  const root = document.querySelector('#linkedin-post-formatter-extension-root');
  const editables = Array.from(document.querySelectorAll('[contenteditable="true"]')).map((element) => {
    const rect = element.getBoundingClientRect();

    return {
      ariaLabel: element.getAttribute('aria-label'),
      className: String(element.className),
      dataPlaceholder: element.getAttribute('data-placeholder'),
      height: Math.round(rect.height),
      inDialog: Boolean(element.closest('[role="dialog"]')),
      text: element.textContent?.slice(0, 140),
      width: Math.round(rect.width),
    };
  });
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).map((element) => {
    const rect = element.getBoundingClientRect();

    return {
      height: Math.round(rect.height),
      text: element.textContent?.slice(0, 300),
      width: Math.round(rect.width),
    };
  });
  const controls = Array.from(document.querySelectorAll('button, [role="button"]')).slice(0, 30).map((element) => {
    const rect = element.getBoundingClientRect();

    return {
      ariaLabel: element.getAttribute('aria-label'),
      height: Math.round(rect.height),
      text: element.textContent?.trim().slice(0, 100),
      width: Math.round(rect.width),
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  });

  return {
    boot: boot ? {
      marker: boot.getAttribute('data-linkedin-formatter-boot'),
      text: boot.textContent,
    } : null,
    editables,
    dialogs,
    href: location.href,
    readyState: document.readyState,
    root: root ? {
      className: root.className,
      diagnostic: root.getAttribute('data-linkedin-formatter-diagnostic'),
      text: root.textContent?.slice(0, 300),
    } : null,
    title: document.title,
    controls,
  };
})()`;

const result = await call('Runtime.evaluate', {
  expression,
  returnByValue: true,
});

console.log(JSON.stringify(result.result.value, null, 2));
socket.close();