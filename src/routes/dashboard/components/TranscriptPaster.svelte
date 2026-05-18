<script lang="ts">
  console.log("TranscriptPaster.svelte component loaded");
  import { editField } from '../store.ts';
  import { toasts } from '../toastStore.ts';

  export let clientId: string;

  let rawText = '';
  let parsing = false;
  let parserType: 'happyscribe' | 'raw' = 'happyscribe';

  function parseHappyScribe(text: string) {
    const segments: { role: string; content: string }[] = [];
    const regex = /^\[(?:\d{2}:)?\d{2}:\d{2}\.\d{2}\]\s+-\s+(.+)$/gm;
    
    let match;
    let lastIndex = 0;
    let currentSpeaker = '';
    
    while ((match = regex.exec(text)) !== null) {
      if (currentSpeaker) {
        const content = text.substring(lastIndex, match.index).trim();
        if (content) {
          segments.push({ role: currentSpeaker, content });
        }
      }
      currentSpeaker = match[1].trim();
      lastIndex = regex.lastIndex;
    }
    
    if (currentSpeaker) {
      const content = text.substring(lastIndex).trim();
      if (content) {
        segments.push({ role: currentSpeaker, content });
      }
    }
    
    return segments;
  }

  async function handleSave() {
    console.log('[TranscriptPaster] handleSave triggered', { clientId, parserType, rawTextLength: rawText.length });
    if (!rawText.trim()) {
      console.log('[TranscriptPaster] No text, aborting.');
      return;
    }
    parsing = true;
    try {
      const notesPayload = {
        text: rawText,
        source: 'manual_paste',
        fetchedAt: new Date().toISOString(),
      };
      console.log('[TranscriptPaster] Preparing to save notes payload:', notesPayload);

      if (parserType === 'happyscribe') {
        console.log('[TranscriptPaster] Parsing as HappyScribe format...');
        const segments = parseHappyScribe(rawText);
        if (segments.length === 0) {
          console.error('[TranscriptPaster] No segments parsed from HappyScribe format.');
          toasts.error('No segments parsed. Check format.');
          parsing = false;
          return;
        }
        console.log(`[TranscriptPaster] Parsed ${segments.length} segments.`);
        
        // Update both lastCalendarEvent.notes and chatHistory
        await editField(clientId, 'lastCalendarEvent.notes', notesPayload);
        console.log('[TranscriptPaster] editField call for lastCalendarEvent.notes completed.');
        await editField(clientId, 'chatHistory', segments);
        console.log('[TranscriptPaster] editField call for chatHistory completed.');
        toasts.success(`Parsed ${segments.length} messages and saved to centralized notes.`);
      } else {
        // Just update lastCalendarEvent.notes for raw text
        console.log('[TranscriptPaster] Saving as raw text...');
        await editField(clientId, 'lastCalendarEvent.notes', notesPayload);
        console.log('[TranscriptPaster] editField call for lastCalendarEvent.notes completed.');
        toasts.success('Raw transcript saved to centralized notes.');
      }
      rawText = '';
      console.log('[TranscriptPaster] Save successful, rawText cleared.');
    } catch (e: any) {
      console.error('[TranscriptPaster] Error in handleSave:', e);
      toasts.error(e.message || 'Failed to save transcript');
    } finally {
      console.log('[TranscriptPaster] handleSave finished.');
      parsing = false;
    }
  }
</script>

<div class="transcript-paster">
  <div class="tp-header">
    <span class="tp-title">External Transcript Parser</span>
    <select bind:value={parserType} class="tp-select">
      <option value="happyscribe">Happy Scribe</option>
      <option value="raw">Raw Text</option>
    </select>
  </div>
  <textarea 
    bind:value={rawText} 
    placeholder="Paste transcript here..." 
    rows="6" 
    class="tp-textarea"
  ></textarea>
  <button class="tp-button" on:click={handleSave} disabled={parsing || !rawText.trim()}>
    {parsing ? 'Saving...' : 'Parse & Save'}
  </button>
</div>

<style lang="scss">
  /* ── TranscriptPaster ──────────────────────────────────────────────────────
     CSS custom-property tree — inherits from :root --irp-* brand tokens.
     Level-2 scoped tokens (--tp-*) are set on the container so every child
     can reference them without re-declaring the fallback chain.
     ──────────────────────────────────────────────────────────────────────── */
  .transcript-paster {
    // ── Level-2 tokens ────────────────────────────────────────────────────
    --tp-accent:        var(--irp-accent,         #02b5bb);
    --tp-accent-hover:  var(--irp-accent-hover,   #02999e);
    --tp-accent-subtle: var(--irp-accent-subtle,  rgba(2,181,187,.1));
    --tp-danger:        var(--irp-danger,         #c62426);
    --tp-surface:       var(--irp-surface,        #fff);
    --tp-surface-2:     var(--irp-surface-2,      #f8f9fa);
    --tp-border:        var(--irp-border,         rgba(0,0,0,.08));
    --tp-text:          var(--irp-text,           #181818);
    --tp-text-2:        var(--irp-text-2,         #343a40);
    --tp-text-muted:    var(--irp-text-muted,     #495057);
    --tp-text-dim:      var(--irp-text-dim,       #868e96);
    --tp-mono:          var(--irp-mono, 'SF Mono', 'JetBrains Mono', monospace);
    --tp-r-sm:          var(--irp-r-sm,   8px);
    --tp-r-md:          var(--irp-r-md,   12px);
    --tp-r-full:        var(--irp-r-full, 9999px);
    --tp-shadow-sm:     var(--irp-shadow-sm, 0 1px 3px rgba(0,0,0,.05));
    --tp-shadow-md:     var(--irp-shadow-md, 0 4px 12px rgba(0,0,0,.08));
    --tp-anim:          cubic-bezier(.16, 1, .3, 1);
    --tp-spring:        cubic-bezier(.34, 1.56, .64, 1);

    // ── Layout ────────────────────────────────────────────────────────────
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
    padding: 14px 16px 16px;
    border-radius: var(--tp-r-md);
    background: var(--tp-surface);
    border: 1px solid var(--tp-border);
    border-left: 3px solid var(--tp-accent);
    box-shadow: var(--tp-shadow-sm);
    position: relative;
    overflow: hidden;
    transition:
      box-shadow 200ms var(--tp-anim),
      border-left-color 200ms var(--tp-anim);

    // Decorative radial glow bubble — top-right corner
    &::after {
      content: '';
      position: absolute;
      top: -24px;
      right: -24px;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(2,181,187,.14) 0%, transparent 68%);
      pointer-events: none;
      z-index: 0;
    }

    &:focus-within {
      border-left-color: var(--tp-accent-hover);
      box-shadow: var(--tp-shadow-md), 0 0 0 3px rgba(2,181,187,.08);
    }

    // Ensure children sit above the decorative bubble
    > * { position: relative; z-index: 1; }
  }

  // ── Header row ────────────────────────────────────────────────────────────
  .tp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  // Title: microphone icon + uppercase label in teal
  .tp-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .055em;
    text-transform: uppercase;
    color: var(--tp-accent);

    &::before {
      content: '🎙';
      font-size: 13px;
      letter-spacing: 0;
      text-transform: none;
      filter: drop-shadow(0 0 4px rgba(2,181,187,.4));
    }
  }

  // Source select — pill-shaped with custom chevron
  .tp-select {
    appearance: none;
    -webkit-appearance: none;
    padding: 4px 26px 4px 10px;
    border: 1.5px solid var(--tp-border);
    border-radius: var(--tp-r-full);
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    color: var(--tp-text-2);
    background-color: var(--tp-surface);
    // Custom teal chevron SVG
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2302b5bb' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 9px center;
    cursor: pointer;
    transition:
      border-color 160ms var(--tp-anim),
      box-shadow   160ms var(--tp-anim),
      background-color 160ms var(--tp-anim);

    &:focus {
      outline: none;
      border-color: var(--tp-accent);
      background-color: var(--tp-accent-subtle);
      box-shadow: 0 0 0 3px rgba(2,181,187,.14);
    }
    &:hover:not(:focus) {
      border-color: rgba(2,181,187,.35);
    }
  }

  // Textarea — monospace, focus-glow, custom scrollbar
  .tp-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1.5px solid var(--tp-border);
    border-radius: var(--tp-r-sm);
    font-size: 12px;
    font-family: var(--tp-mono);
    line-height: 1.7;
    color: var(--tp-text-2);
    background-color: var(--tp-surface-2);
    resize: vertical;
    min-height: 110px;
    transition:
      border-color    180ms var(--tp-anim),
      background-color 180ms var(--tp-anim),
      box-shadow      180ms var(--tp-anim);

    &::placeholder {
      color: var(--tp-text-dim);
      font-style: italic;
    }

    &:focus {
      outline: none;
      border-color: var(--tp-accent);
      background-color: var(--tp-surface);
      box-shadow:
        0 0 0 3px rgba(2,181,187,.12),
        0 2px 8px rgba(0,0,0,.06);
    }

    // Thin teal scrollbar (Webkit)
    &::-webkit-scrollbar       { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: rgba(2,181,187,.3);
      border-radius: 2px;
      &:hover { background: rgba(2,181,187,.55); }
    }
  }

  // CTA button — teal gradient + shine sweep + spring lift
  .tp-button {
    align-self: stretch;
    padding: 10px 20px;
    border: none;
    border-radius: var(--tp-r-sm);
    background: linear-gradient(135deg, var(--tp-accent) 0%, var(--tp-accent-hover) 100%);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: .03em;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition:
      box-shadow 200ms var(--tp-anim),
      filter     200ms var(--tp-anim),
      transform  220ms var(--tp-spring);

    // Shine sweep overlay
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        105deg,
        transparent       30%,
        rgba(255,255,255,.22) 50%,
        transparent       70%
      );
      transform: translateX(-100%);
      transition: transform 500ms var(--tp-anim);
    }

    &:hover:not(:disabled) {
      box-shadow:
        0 4px 22px rgba(2,181,187,.38),
        0 2px 6px rgba(0,0,0,.1);
      transform: translateY(-2px);
      filter: brightness(1.06);

      &::before { transform: translateX(100%); }
    }

    &:active:not(:disabled) {
      transform: translateY(0) scale(.97);
      box-shadow: 0 2px 8px rgba(2,181,187,.22);
    }

    &:disabled {
      background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
      opacity: .6;

      &::before { display: none; }
    }
  }
</style>
