<script lang="ts">
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
    if (!rawText.trim()) return;
    parsing = true;
    try {
      if (parserType === 'happyscribe') {
        const segments = parseHappyScribe(rawText);
        if (segments.length === 0) {
          toasts.error('No segments parsed. Check format.');
          parsing = false;
          return;
        }
        
        // Update both transcript and chatHistory
        await editField(clientId, 'transcript', rawText);
        await editField(clientId, 'chatHistory', segments);
        toasts.success(`Parsed ${segments.length} messages and saved.`);
      } else {
        await editField(clientId, 'transcript', rawText);
        toasts.success('Raw transcript saved.');
      }
      rawText = '';
    } catch (e: any) {
      toasts.error(e.message || 'Failed to save transcript');
    } finally {
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