import { marked } from 'marked';

import type { EditorNode } from './exportLinkedInText';
import { looksLikeMarkdown, plainTextToTipTap } from './markdownToTipTap';
import { sanitizePastedHTML } from './pastedHtml';

export type ImportedDocumentContent =
  | { format: 'json'; document: EditorNode }
  | { format: 'html'; html: string };

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ACCEPTED_DOCUMENT_TYPES = ['.txt', '.md', '.markdown', '.doc', '.docx', 'text/plain', 'text/markdown', 'text/x-markdown', DOCX_MIME_TYPE];

export function getAcceptedDocumentTypes(): string {
  return ACCEPTED_DOCUMENT_TYPES.join(',');
}

export async function importDocumentFile(file: File): Promise<ImportedDocumentContent> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  if (fileName.endsWith('.docx') || fileType === DOCX_MIME_TYPE) {
    return importWordDocument(file);
  }

  if (fileName.endsWith('.doc')) {
    throw new Error('Legacy .doc files are not supported. Save the Word document as .docx and upload it again.');
  }

  if (!isTextLikeFile(fileName, fileType)) {
    throw new Error('Upload a .txt, .md, .markdown, or .docx file.');
  }

  const text = stripByteOrderMark(await readFileText(file));

  if (isMarkdownFile(fileName, fileType) || (!isPlainTextFile(fileName, fileType) && looksLikeMarkdown(text))) {
    return { format: 'html', html: markdownFileToHtml(text) };
  }

  return { format: 'json', document: plainTextToTipTap(text) };
}

function isTextLikeFile(fileName: string, fileType: string): boolean {
  return isPlainTextFile(fileName, fileType) || isMarkdownFile(fileName, fileType) || fileType.startsWith('text/');
}

function isMarkdownFile(fileName: string, fileType: string): boolean {
  return fileName.endsWith('.md') || fileName.endsWith('.markdown') || fileType === 'text/markdown' || fileType === 'text/x-markdown';
}

function isPlainTextFile(fileName: string, fileType: string): boolean {
  return fileName.endsWith('.txt') || fileType === 'text/plain';
}

function stripByteOrderMark(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function markdownFileToHtml(markdown: string): string {
  const renderedHtml = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
  return sanitizePastedHTML(normalizeHeadingLevels(renderedHtml)).trim();
}

function normalizeHeadingLevels(html: string): string {
  return html
    .replace(/<h1(\s[^>]*)?>/gi, '<h2>')
    .replace(/<\/h1>/gi, '</h2>')
    .replace(/<h[4-6](\s[^>]*)?>/gi, '<h3>')
    .replace(/<\/h[4-6]>/gi, '</h3>');
}

async function importWordDocument(file: File): Promise<ImportedDocumentContent> {
  const mammoth = (await import('mammoth')).default;
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await readFileArrayBuffer(file) },
    {
      includeDefaultStyleMap: true,
      styleMap: [
        "p[style-name='Title'] => h2:fresh",
        "p[style-name='Subtitle'] => p:fresh",
        "p[style-name='Heading 1'] => h2:fresh",
        "p[style-name='Heading 2'] => h3:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    },
  );
  const html = sanitizePastedHTML(result.value).trim();

  if (!html) {
    throw new Error('No readable text was found in that Word document.');
  }

  return { format: 'html', html };
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return readWithFileReader(file, 'text') as Promise<string>;
}

async function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }

  return readWithFileReader(file, 'arrayBuffer') as Promise<ArrayBuffer>;
}

function readWithFileReader(file: File, kind: 'text' | 'arrayBuffer'): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string' || reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('The selected file could not be read.'));
      }
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('The selected file could not be read.')));

    if (kind === 'text') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}