import { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';

import type { CopyStatus } from '../components/CopyPanel';
import { DraftHistoryPanel } from '../components/DraftHistoryPanel';
import { EditorShell } from '../components/EditorShell';
import { HelpPanel } from '../components/HelpPanel';
import { LinkedInPreview } from '../components/LinkedInPreview';
import { copyPlainText } from '../lib/clipboard';
import { exportLinkedInText, getLinkedInCharacterSummary, type EditorNode } from '../lib/exportLinkedInText';
import type { FeedPreviewMode } from '../lib/feedPreview';
import {
  clearDraft,
  deleteDraftSnapshot,
  loadDraft,
  loadDraftHistory,
  saveDraft,
  saveDraftSnapshot,
  type DraftSnapshot,
} from '../lib/storage';

interface LinkedInComposerOverlayProps {
  open: boolean;
  onClose: () => void;
  onPost: (text: string) => Promise<boolean>;
}

type Status = 'idle' | 'copied' | 'posting' | 'posted' | 'error';

const EMPTY_DOCUMENT: EditorNode = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function LinkedInComposerOverlay({ open, onClose, onPost }: LinkedInComposerOverlayProps) {
  const [initialLoad] = useState(loadDraft);
  const [editorDocument, setEditorDocument] = useState<EditorNode>(() => initialLoad.document ?? EMPTY_DOCUMENT);
  const [editorVersion, setEditorVersion] = useState(0);
  const [draftHistory, setDraftHistory] = useState<DraftSnapshot[]>(loadDraftHistory);
  const [feedPreviewMode, setFeedPreviewMode] = useState<FeedPreviewMode | null>(null);
  const [showFeedCutoff, setShowFeedCutoff] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>({ state: 'idle', message: '' });
  const [storageNotice, setStorageNotice] = useState<string | null>(() => initialLoad.error);
  const [status, setStatus] = useState<Status>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const exportedText = exportLinkedInText(editorDocument);
  const summary = getLinkedInCharacterSummary(exportedText);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      document.querySelector<HTMLElement>('#linkedin-post-formatter-extension-root .rich-editor-content')?.focus();
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [open, editorVersion]);

  function handleDocumentChange(nextDocument: EditorNode) {
    setEditorDocument(nextDocument);
    const result = saveDraft(nextDocument);

    if (!result.ok) {
      setStorageNotice(result.message);
    }

    setStatus('idle');
    setStatusMessage('');
  }

  function handleReplaceDocument(nextDocument: EditorNode) {
    const result = saveDraft(nextDocument);

    if (!result.ok) {
      setStorageNotice(result.message);
    } else {
      setStorageNotice(null);
    }

    setEditorDocument(nextDocument);
    setEditorVersion((version) => version + 1);
    setStatus('idle');
    setStatusMessage('');
  }

  function handleReset() {
    clearDraft();
    setEditorDocument(EMPTY_DOCUMENT);
    setEditorVersion((version) => version + 1);
    setStorageNotice(null);
    setCopyStatus({ state: 'idle', message: '' });
    setStatus('idle');
    setStatusMessage('');
  }

  async function handleCopy() {
    try {
      await copyPlainText(exportedText);
      setCopyStatus({ state: 'idle', message: '' });
      setStatus('copied');
      setStatusMessage('Copied');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Copy failed';
      setCopyStatus({ state: 'error', message });
      setStatus('error');
      setStatusMessage(message);
    }
  }

  function handleSaveDraftSnapshot(title: string) {
    const result = saveDraftSnapshot(editorDocument, title, summary.count);

    if (result.ok) {
      setDraftHistory(loadDraftHistory());
      setStorageNotice(null);
    } else {
      setStorageNotice(result.message);
    }
  }

  function handleRestoreDraftSnapshot(draft: DraftSnapshot) {
    handleReplaceDocument(draft.document);
    setCopyStatus({ state: 'idle', message: '' });
  }

  function handleDeleteDraftSnapshot(id: string) {
    const result = deleteDraftSnapshot(id);

    if (result.ok) {
      setDraftHistory(loadDraftHistory());
      setStorageNotice(null);
    } else {
      setStorageNotice(result.message);
    }
  }

  async function handlePost() {
    if (!exportedText.trim()) {
      return;
    }

    setStatus('posting');
    setStatusMessage('Posting through LinkedIn...');

    if (await onPost(exportedText)) {
      setStatus('posted');
      setStatusMessage('Posted');
      return;
    }

    setStatus('error');
    setStatusMessage('LinkedIn did not expose a post composer. Close this and try Start a post again.');
  }

  if (!open) {
    return null;
  }

  return (
    <div className="lipf-modal-backdrop" role="presentation">
      <section className="lipf-panel" role="dialog" aria-modal="true" aria-label="LinkedIn Post Formatter">
        <div className="lipf-header">
          <div className="lipf-brand">
            <div className="lipf-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" focusable="false">
                <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708C16 15.487 15.474 16 14.825 16H1.175C.526 16 0 15.487 0 14.854V1.146Zm4.943 12.248V6.169H2.542v7.225h2.401Zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.823 0-1.359.539-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016Zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4Z" />
              </svg>
            </div>
            <div>
              <p className="lipf-title">LinkedIn Post Formatter</p>
              <p className="lipf-subtitle">Draft with familiar formatting, then post through LinkedIn.</p>
            </div>
          </div>
          <div className="lipf-actions">
            <a
              className="lipf-github-link"
              href="https://github.com/markrussinovich/LinkedIn-Formatter"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open GitHub repository"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              <span>GitHub</span>
            </a>
            <button type="button" className="lipf-icon-button" aria-label="Close formatter" onClick={onClose}>
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        </div>

        <div className="lipf-full-workspace">
          {storageNotice ? <p className="inline-alert panel-alert" role="status">{storageNotice}</p> : null}
          <LinkedInPreview summary={summary} />
          <EditorShell
            key={editorVersion}
            exportedText={exportedText}
            feedPreviewMode={feedPreviewMode}
            initialContent={editorDocument}
            showFeedCutoff={showFeedCutoff}
            onDocumentChange={handleDocumentChange}
            onFeedCutoffChange={setShowFeedCutoff}
            onFeedPreviewModeChange={setFeedPreviewMode}
            onReplaceDocument={handleReplaceDocument}
            onReset={handleReset}
          />
          <DraftHistoryPanel
            drafts={draftHistory}
            onDelete={handleDeleteDraftSnapshot}
            onRestore={handleRestoreDraftSnapshot}
            onSave={handleSaveDraftSnapshot}
          />
          <HelpPanel />
        </div>
        <footer className="lipf-footer">
          <p className={`lipf-status is-${status}`} role="status">{statusMessage || copyStatus.message}</p>
          <div className="lipf-footer-actions">
            <button type="button" className="lipf-secondary-button" disabled={!exportedText} onClick={handleCopy}>Copy for LinkedIn</button>
            <button type="button" className="lipf-primary-button" disabled={!exportedText.trim() || status === 'posting'} onClick={() => void handlePost()}>
              <Send aria-hidden="true" size={16} />
              Post
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
