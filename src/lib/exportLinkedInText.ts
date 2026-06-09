import { LINKEDIN_POST_CHARACTER_LIMIT, getCharacterCountStatus } from './constants';
import { type UnicodeStyleOptions, styleText } from './unicodeStyles';

const HORIZONTAL_RULE_TEXT = '────────';
const INDENT_TEXT = '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0';

export interface EditorMark {
  type?: string;
  attrs?: Record<string, unknown>;
}

export interface EditorNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: EditorMark[];
  content?: EditorNode[];
}

export function exportLinkedInText(document: EditorNode | null | undefined): string {
  if (!document) {
    return '';
  }

  const blocks = document.type === 'doc' ? document.content ?? [] : [document];
  return trimPlainWhitespace(renderBlocks(blocks));
}

export function countLinkedInCharacters(text: string): number {
  return Array.from(text.normalize('NFC')).length;
}

export function getLinkedInCharacterStatus(text: string) {
  return getCharacterCountStatus(countLinkedInCharacters(text));
}

export function getLinkedInCharacterSummary(text: string) {
  const count = countLinkedInCharacters(text);

  return {
    count,
    limit: LINKEDIN_POST_CHARACTER_LIMIT,
    remaining: LINKEDIN_POST_CHARACTER_LIMIT - count,
    status: getCharacterCountStatus(count),
  };
}

function renderBlocks(nodes: EditorNode[]): string {
  const renderedBlocks = nodes
    .map((node) => ({ node, text: renderBlock(node) }))
    .filter((block) => block.text.length > 0);

  return renderedBlocks.reduce((output, block, index) => {
    if (index === 0) {
      return block.text;
    }

    const previous = renderedBlocks[index - 1];
    const separator = getBlockSeparator(previous.node, block.node);
    return `${output}${separator}${block.text}`;
  }, '');
}

function getBlockSeparator(previous: EditorNode, current: EditorNode): string {
  if (previous.type === 'horizontalRule' || current.type === 'horizontalRule') {
    return '\n';
  }

  if (previous.type === 'heading' && (current.type === 'bulletList' || current.type === 'orderedList')) {
    return '\n';
  }

  return '\n\n';
}

function trimPlainWhitespace(text: string): string {
  return text.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, '');
}

function renderBlock(node: EditorNode): string {
  switch (node.type) {
    case 'doc':
      return renderBlocks(node.content ?? []);
    case 'paragraph':
      return renderInline(node.content ?? []);
    case 'heading':
      return renderInline(node.content ?? [], [{ type: 'bold' }]);
    case 'blockquote':
      return renderBlockquote(node);
    case 'horizontalRule':
      return HORIZONTAL_RULE_TEXT;
    case 'bulletList':
      return renderList(node, 'bullet');
    case 'orderedList':
      return renderList(node, 'ordered');
    case 'listItem':
      return renderListItemLines(node).join('\n');
    case 'text':
      return renderTextNode(node);
    case 'hardBreak':
      return '\n';
    default:
      return node.content ? renderBlocks(node.content) : '';
  }
}

function renderInline(nodes: EditorNode[], inheritedMarks: EditorMark[] = []): string {
  return nodes.map((node) => renderInlineNode(node, inheritedMarks)).join('');
}

function renderInlineNode(node: EditorNode, inheritedMarks: EditorMark[]): string {
  if (node.type === 'text') {
    return renderTextNode(node, inheritedMarks);
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  return node.content ? renderInline(node.content, inheritedMarks) : '';
}

function renderTextNode(node: EditorNode, inheritedMarks: EditorMark[] = []): string {
  const text = node.text ?? '';
  const marks = [...inheritedMarks, ...(node.marks ?? [])];
  const href = getLinkHref(marks);
  const styledText = styleText(text, getStyleOptions(marks));

  if (!href) {
    return styledText;
  }

  if (text.trim() === href) {
    return href;
  }

  return `${styledText} (${href})`;
}

function renderBlockquote(node: EditorNode): string {
  return renderBlocks(node.content ?? [])
    .split('\n')
    .map((line) => (line.trim() ? `${INDENT_TEXT}${line}` : ''))
    .join('\n');
}

function renderList(node: EditorNode, kind: 'bullet' | 'ordered', depth = 0): string {
  let orderedIndex = getOrderedStart(node);
  const lines: string[] = [];
  const indent = INDENT_TEXT.repeat(depth);

  for (const item of node.content ?? []) {
    if (item.type !== 'listItem') {
      continue;
    }

    const itemLines = renderListItemLines(item, depth);
    const firstLine = itemLines.shift() ?? '';
    const prefix = kind === 'bullet' ? `${indent}• ` : `${indent}${orderedIndex}. `;
    lines.push(`${prefix}${firstLine}`.trimEnd());
    lines.push(...itemLines);
    orderedIndex += 1;
  }

  return lines.join('\n');
}

function renderListItemLines(node: EditorNode, depth = 0): string[] {
  const leadParts: string[] = [];
  const extraLines: string[] = [];

  for (const child of node.content ?? []) {
    if (child.type === 'paragraph' || child.type === 'heading') {
      const text = renderInline(child.content ?? []).trim();

      if (text) {
        leadParts.push(text);
      }
    } else if (child.type === 'bulletList') {
      extraLines.push(...renderList(child, 'bullet', depth + 1).split('\n').filter(Boolean));
    } else if (child.type === 'orderedList') {
      extraLines.push(...renderList(child, 'ordered', depth + 1).split('\n').filter(Boolean));
    } else {
      const text = renderBlock(child).trim();

      if (text) {
        leadParts.push(text);
      }
    }
  }

  return [leadParts.join(' '), ...extraLines].filter((line) => line.length > 0);
}

function getStyleOptions(marks: EditorMark[]): UnicodeStyleOptions {
  return {
    bold: marks.some((mark) => mark.type === 'bold'),
    italic: marks.some((mark) => mark.type === 'italic'),
    code: marks.some((mark) => mark.type === 'code'),
    strike: marks.some((mark) => mark.type === 'strike'),
    underline: marks.some((mark) => mark.type === 'underline'),
  };
}

function getLinkHref(marks: EditorMark[]): string | null {
  const link = marks.find((mark) => mark.type === 'link');
  const href = link?.attrs?.href;

  return typeof href === 'string' && href.trim() ? href.trim() : null;
}

function getOrderedStart(node: EditorNode): number {
  const start = node.attrs?.start;

  return typeof start === 'number' && Number.isFinite(start) ? start : 1;
}