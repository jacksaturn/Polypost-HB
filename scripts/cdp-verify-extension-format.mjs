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

const draft = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'LinkedIn Post Formatter' }] },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'A client-side formatter for drafting LinkedIn posts.' }],
    },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Features' }] },
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'TipTap rich text editor' }] }] }],
    },
  ],
};

await call('Runtime.evaluate', {
  expression: `(() => {
    localStorage.setItem('linkedin-format:draft-v1', ${JSON.stringify(JSON.stringify(draft))});
    localStorage.removeItem('linkedin-format:draft-history-v1');
    return true;
  })()`,
  returnByValue: true,
});

await call('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 5000));

const startPost = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const control = Array.from(document.querySelectorAll('button, [role="button"]')).find((element) => /start a post/i.test(`${element.textContent ?? ''} ${element.getAttribute('aria-label') ?? ''}`));
    if (!control) {
      return null;
    }
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
await new Promise((resolve) => setTimeout(resolve, 1200));

const verification = await call('Runtime.evaluate', {
  expression: String.raw`(() => {
    const root = document.querySelector('#linkedin-post-formatter-extension-root');
    const editor = root?.querySelector('.rich-editor-content');
    const heading = editor?.querySelector('h2');
    const features = Array.from(editor?.querySelectorAll('h3') ?? []).find((node) => node.textContent?.includes('Features'));
    const bullet = editor?.querySelector('ul > li');

    function styleFor(element) {
      if (!element) {
        return null;
      }

      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return {
        display: style.display,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        marginBottom: style.marginBottom,
        text: element.textContent,
        top: Math.round(rect.top),
      };
    }

    return {
      rootText: root?.textContent?.slice(0, 260),
      editorText: editor?.textContent,
      headingTag: heading?.tagName,
      heading: styleFor(heading),
      featuresTag: features?.tagName,
      features: styleFor(features),
      bulletTag: bullet?.tagName,
      bullet: styleFor(bullet),
      featureToBulletGap: features && bullet ? Math.round(bullet.getBoundingClientRect().top - features.getBoundingClientRect().bottom) : null,
      activeElementClass: document.activeElement?.className,
    };
  })()`,
  returnByValue: true,
});

console.log(JSON.stringify(verification.result.value, null, 2));
socket.close();