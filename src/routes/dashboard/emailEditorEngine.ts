/**
 * emailEditorEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure-function helper that drives the contentEditable WYSIWYG layer inside
 * the sandboxed email-preview iframe.
 *
 * APPROACH
 *   The iframe keeps its style isolation
 *   (sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox").
 *   Note: `allow-popups-to-escape-sandbox` lets links the operator clicks (the
 *   email CTAs, which use <base target="_blank">) open as NORMAL, un-sandboxed
 *   tabs — without it the new tab inherits this sandbox and, lacking
 *   `allow-scripts`, the destination page (e.g. /answer) can't run its scripts.
 *   We deliberately still omit `allow-scripts` here so the email body itself
 *   stays script-disabled inside the drawer.
 *
 *   We reach inside the iframe document from the parent via `contentDocument`

 *   (only possible because the srcdoc + allow-same-origin combo puts it in the
 *   same origin) and:
 *     • Toggle `body.contentEditable` on/off
 *     • Wire an `input` listener that copies `body.innerHTML` back to the
 *       parent Svelte component via a callback
 *     • Call `document.execCommand(...)` on the iframe's document for B/I/U etc.
 *     • Call `execCommand('insertHTML', ...)` for snippet injections
 *
 * NOTHING in here depends on Svelte stores or external libraries.
 * All functions are pure / side-effect isolated to the given `iframe` argument.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'undo'
  | 'redo';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the contentDocument of the iframe, or null if it's not accessible yet. */
function getDoc(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument ?? null;
  } catch {
    return null;
  }
}

/** Returns the body of the iframe's document, or null if not available. */
function getBody(iframe: HTMLIFrameElement): HTMLElement | null {
  return getDoc(iframe)?.body ?? null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the `srcdoc` string that is set on the iframe's `srcdoc` attribute.
 * Used in both preview mode and visual edit mode — the only difference is
 * whether we later toggle `body.contentEditable` on.
 *
 * The `editorStyles` parameter injects a small CSS block that shows a subtle
 * blue dotted border around the body when in edit mode, so the operator always
 * knows the canvas is live.
 */
export function buildIframeSrcDoc(
  html: string,
  { editHint = false }: { editHint?: boolean } = {},
): string {
  const editCSS = editHint
    ? `<style>
        body { outline: 2px dashed rgba(99,102,241,0.4) !important; outline-offset: 4px; }
        body::before {
          content: '✏️  Click anywhere to edit';
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 11px;
          color: rgba(99,102,241,0.7);
          text-align: center;
          padding: 4px 0 8px;
          letter-spacing: 0.04em;
          animation: editorHintFade 2.5s ease forwards;
        }
        @keyframes editorHintFade {
          0%   { opacity: 1; }
          60%  { opacity: 1; }
          100% { opacity: 0; height: 0; padding: 0; margin: 0; overflow: hidden; }
        }
      </style>`
    : '';

  return `<!doctype html><html><head>`
    + `<meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
    + `<base target="_blank">`
    + editCSS
    + `</head>`
    + `<body style="margin:0;padding:0;background:#f5f6f7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">`
    + html
    + `</body></html>`;
}

/** Options for attachContentEditable. */
export interface AttachContentEditableOptions {
  /** Debounce delay in ms before onInput fires. Default 300. */
  debounceMs?: number;
  /**
   * Called whenever the selection changes inside the iframe.
   * Use this to update toolbar format-state highlights (bold/italic/underline).
   * The cleanup returned by attachContentEditable automatically removes this
   * listener — callers do not need to do so manually.
   */
  onSelectionChange?: () => void;
}

/**
 * Enables contentEditable on the iframe body.
 *
 * @param iframe   The iframe element (must be loaded with allow-same-origin)
 * @param onInput  Called (debounced) with the updated innerHTML whenever the
 *                 user edits content. Use this to sync editableBody in Svelte.
 * @param options  Optional: debounceMs (default 300) and onSelectionChange
 *                 callback for toolbar highlight updates.
 * @returns A cleanup function that removes ALL wired listeners and re-disables
 *          editing. Callers MUST call this when leaving visual mode.
 */
export function attachContentEditable(
  iframe: HTMLIFrameElement,
  onInput: (html: string) => void,
  options: AttachContentEditableOptions = {},
): () => void {
  const { debounceMs = 300, onSelectionChange } = options;

  const body = getBody(iframe);
  const doc = getDoc(iframe);
  if (!body || !doc) return () => {};

  body.contentEditable = 'true';
  body.spellcheck = false;
  // Ensure focus ring comes from our injected CSS, not the browser default
  (body.style as any).outline = 'none';

  let timer: ReturnType<typeof setTimeout> | null = null;

  function handleInput() {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      // Read innerHTML from the body (strips our `::before` hint pseudo-element,
      // which is CSS-only and not part of the DOM)
      const html = body?.innerHTML ?? '';
      onInput(html);
    }, debounceMs);
  }

  body.addEventListener('input', handleInput);

  // Wire selectionchange if a callback was provided
  if (onSelectionChange) {
    doc.addEventListener('selectionchange', onSelectionChange);
  }

  // Cleanup function: removes ALL listeners, disables contentEditable
  return () => {
    if (timer !== null) clearTimeout(timer);
    body.removeEventListener('input', handleInput);
    if (onSelectionChange) {
      // Use the same `doc` reference — safe even after iframe reload because
      // this cleanup is always called before the srcdoc swap.
      doc.removeEventListener('selectionchange', onSelectionChange);
    }
    if (body.isConnected) {
      body.contentEditable = 'false';
    }
  };
}

/**
 * Removes contentEditable from the iframe body (without reloading the iframe).
 * Useful when the operator switches back to Preview mode — the iframe stays
 * alive and the edits are preserved in `editableBody`.
 */
export function detachContentEditable(iframe: HTMLIFrameElement): void {
  const body = getBody(iframe);
  if (body) {
    body.contentEditable = 'false';
  }
}

/**
 * Calls `document.execCommand` on the iframe's document.
 * Works for bold, italic, underline, lists, undo, redo.
 *
 * The iframe must have focus for this to apply to the current selection.
 * We call `iframe.contentWindow.focus()` + `body.focus()` ahead of the command
 * to ensure focus is in the right document.
 */
export function execFormatCommand(
  iframe: HTMLIFrameElement,
  command: FormatCommand,
): void {
  const doc = getDoc(iframe);
  if (!doc) return;
  // Ensure the iframe has focus so the selection state is active
  try { iframe.contentWindow?.focus(); } catch { /* silent */ }
  doc.execCommand(command, false);
}

/**
 * Checks whether a format command is currently active at the caret.
 * Used to highlight the Bold/Italic/Underline toolbar buttons.
 */
export function queryFormatState(
  iframe: HTMLIFrameElement,
  command: FormatCommand,
): boolean {
  const doc = getDoc(iframe);
  if (!doc) return false;
  try {
    return doc.queryCommandState(command);
  } catch {
    return false;
  }
}

/**
 * Inserts an HTML string at the current caret position inside the iframe.
 * Uses execCommand('insertHTML') — works in all major browsers for
 * contentEditable elements. Falls back to a no-op if not available.
 */
export function insertHtmlAtCaret(
  iframe: HTMLIFrameElement,
  html: string,
): void {
  const doc = getDoc(iframe);
  if (!doc) return;
  try { iframe.contentWindow?.focus(); } catch { /* silent */ }
  doc.execCommand('insertHTML', false, html);
}

/**
 * Prompts for a URL and wraps the current selection in an anchor tag.
 * Safe to call from a toolbar "🔗 Link" button.
 */
export function insertLink(iframe: HTMLIFrameElement): void {
  const doc = getDoc(iframe);
  if (!doc) return;

  // Read current selection text to use as default href suggestion
  const selection = doc.getSelection();
  const selectedText = selection?.toString() ?? '';

  const url = window.prompt(
    'Enter URL:',
    selectedText.startsWith('http') ? selectedText : 'https://',
  );
  if (!url) return;

  try { iframe.contentWindow?.focus(); } catch { /* silent */ }

  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    // There is selected text — wrap it in an anchor
    doc.execCommand('createLink', false, url);
  } else {
    // No selection — insert the URL as text wrapped in an anchor
    doc.execCommand(
      'insertHTML',
      false,
      `<a href="${url}" target="_blank" style="color:#1e3a5f;">${url}</a>`,
    );
  }
}

/**
 * Reads the current innerHTML of the iframe body.
 * Call this just before sending to get the final edited HTML.
 */
export function readIframeHtml(iframe: HTMLIFrameElement): string {
  return getBody(iframe)?.innerHTML ?? '';
}
