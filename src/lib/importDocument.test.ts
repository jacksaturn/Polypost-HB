import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const convertToHtmlMock = vi.hoisted(() => vi.fn());

vi.mock('mammoth', () => ({
  default: {
    convertToHtml: convertToHtmlMock,
  },
}));

import { importDocumentFile } from './importDocument';

describe('importDocumentFile', () => {
  it('imports BOM-prefixed Markdown by extension', async () => {
    const file = new File(['\uFEFF## Heading\n\n- One\n- Two'], 'post.md', { type: '' });

    await expect(importDocumentFile(file)).resolves.toEqual({
      format: 'html',
      html: '<h2>Heading</h2>\n<ul>\n<li>One</li>\n<li>Two</li>\n</ul>',
    });
  });

  it('imports the repository README from the top of the file', async () => {
    const markdown = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
    const file = new File([markdown], 'README.md', { type: '' });
    const importedDocument = await importDocumentFile(file);

    expect(importedDocument.format).toBe('html');

    if (importedDocument.format === 'html') {
      expect(importedDocument.html.startsWith('<h2>LinkedIn Post Formatter</h2>')).toBe(true);
      expect(importedDocument.html).toContain('<h2>Features</h2>');
      expect(importedDocument.html).toContain('<ul>');
      expect(importedDocument.html).not.toContain('<img');
    }
  });

  it('imports plain text without parsing Markdown marks', async () => {
    const file = new File(['**Plain** text'], 'post.txt', { type: 'text/plain' });

    await expect(importDocumentFile(file)).resolves.toEqual({
      format: 'json',
      document: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '**Plain** text' }] }],
      },
    });
  });

  it('imports docx as sanitized HTML', async () => {
    convertToHtmlMock.mockResolvedValueOnce({
      value: '<p><span style="font-weight:700">Word title</span></p><img src="tracking.gif">',
      messages: [],
    });
    const file = new File(['docx bytes'], 'post.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await expect(importDocumentFile(file)).resolves.toEqual({
      format: 'html',
      html: '<p><span><strong>Word title</strong></span></p>',
    });
    expect(convertToHtmlMock).toHaveBeenCalledWith(
      { arrayBuffer: expect.any(ArrayBuffer) },
      expect.objectContaining({ includeDefaultStyleMap: true }),
    );
  });

  it('rejects legacy doc files', async () => {
    const file = new File(['legacy doc bytes'], 'post.doc', { type: 'application/msword' });

    await expect(importDocumentFile(file)).rejects.toThrow('Legacy .doc files are not supported');
  });
});