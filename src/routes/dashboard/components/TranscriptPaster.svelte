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

<style>
  .transcript-paster {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px;
    border-radius: 8px;
    margin-top: 8px;
  }
  .tp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tp-title {
    font-size: 14px;
    font-weight: 600;
    color: #334155;
  }
  .tp-select {
    padding: 4px 8px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 13px;
    background: white;
  }
  .tp-textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 13px;
    resize: vertical;
  }
  .tp-button {
    align-self: flex-end;
    padding: 6px 12px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
  .tp-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>