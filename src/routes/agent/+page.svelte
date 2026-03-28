<script lang="ts">
  import { onMount } from "svelte";

  const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";
  const AGENT_KEY = import.meta.env.VITE_AGENT_KEY || "irp-agent-2025";

  let email = "";
  let transcript = "";
  let noShow = false;
  let requiresQuote = false;

  let isLoading = false;
  let result: { success: boolean; message: string; outcome?: string; emailsScheduled?: any[] } | null = null;
  let error = "";

  async function submitOutcome() {
    error = "";
    result = null;

    if (!email.trim()) {
      error = "Client email is required.";
      return;
    }

    isLoading = true;

    try {
      const response = await fetch(`${API_URL}/api/agent/call-outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agent-key": AGENT_KEY,
        },
        body: JSON.stringify({
          email: email.trim(),
          transcript: transcript.trim(),
          noShow,
          requiresQuote,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        error = data.error || "Something went wrong.";
      } else {
        result = data;
        // Reset form after success
        email = "";
        transcript = "";
        noShow = false;
        requiresQuote = false;
      }
    } catch (err: any) {
      error = "Network error. Make sure the server is running.";
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>IRP Agent Panel — Call Outcome</title>
</svelte:head>

<div class="agent-page">
  <header class="agent-header">
    <img
      src="https://www.internationalrelocationpartner.com/IRP-LOGO.jpg"
      alt="IRP Logo"
      class="logo"
    />
    <div class="header-text">
      <h1>Agent Panel</h1>
      <p>Post-call outcome entry — internal use only</p>
    </div>
  </header>

  <div class="card">
    <h2>Log Call Outcome</h2>
    <p class="subtitle">
      After each consultation, enter the client's email, paste the transcript,
      and configure the outcome toggles before submitting.
    </p>

    <!-- Email -->
    <div class="field">
      <label for="email">Client Email *</label>
      <input
        id="email"
        type="email"
        placeholder="client@example.com"
        bind:value={email}
        class="input"
      />
    </div>

    <!-- Transcript -->
    <div class="field">
      <label for="transcript">Call Transcript</label>
      <textarea
        id="transcript"
        placeholder="Paste the full call transcript here..."
        bind:value={transcript}
        class="textarea"
        rows="12"
      ></textarea>
      <span class="hint">Stored in Firestore. Will be used by the AI agent when activated.</span>
    </div>

    <!-- Toggle: No Show -->
    <div class="field toggle-field">
      <div class="toggle-info">
        <span class="toggle-label">No Show</span>
        <span class="toggle-description">
          Client did not attend the call. A re-engagement email will be sent in 1 hour.
        </span>
      </div>
      <button
        class="toggle {noShow ? 'toggle--on' : ''}"
        on:click={() => noShow = !noShow}
        aria-pressed={noShow}
        type="button"
      >
        <span class="toggle-knob"></span>
      </button>
    </div>

    <!-- Toggle: Requires Quote -->
    <div class="field toggle-field" class:toggle-field--disabled={noShow}>
      <div class="toggle-info">
        <span class="toggle-label">Requires Quote</span>
        <span class="toggle-description">
          {#if noShow}
            Not applicable when "No Show" is active.
          {:else if requiresQuote}
            Client is qualified. Will receive: recap + proposal progress → check-in → proposal feedback.
          {:else}
            Client does not need a quote. Will enter nurture: feedback → newsletter → YouTube.
          {/if}
        </span>
      </div>
      <button
        class="toggle {requiresQuote ? 'toggle--on' : ''}"
        on:click={() => { if (!noShow) requiresQuote = !requiresQuote; }}
        aria-pressed={requiresQuote}
        disabled={noShow}
        type="button"
      >
        <span class="toggle-knob"></span>
      </button>
    </div>

    <!-- Outcome Preview -->
    <div class="outcome-preview outcome-preview--{noShow ? 'noshow' : requiresQuote ? 'quote' : 'nurture'}">
      <strong>Email sequence that will fire:</strong>
      {#if noShow}
        <ul>
          <li>🔴 No Show email → sent in 1 hour</li>
        </ul>
      {:else if requiresQuote}
        <ul>
          <li>📋 Call Recap + Proposal in Progress → sent in 1 hour</li>
          <li>📞 Management Check-In → sent in 7 days</li>
          <li>📄 Proposal Feedback → sent in 14 days</li>
        </ul>
      {:else}
        <ul>
          <li>💬 Call Feedback → sent in 1 hour</li>
          <li>📰 Newsletter Invitation → sent in 3 days</li>
          <li>▶️ YouTube Channel → sent in 7 days</li>
        </ul>
      {/if}
    </div>

    {#if error}
      <div class="alert alert--error">{error}</div>
    {/if}

    {#if result}
      <div class="alert alert--success">
        <strong>✅ {result.message}</strong>
        {#if result.emailsScheduled && result.emailsScheduled.length > 0}
          <ul class="scheduled-list">
            {#each result.emailsScheduled as item}
              <li>
                <code>{item.type}</code> →
                {new Date(item.scheduledAt).toLocaleString("en-US", {
                  timeZone: "America/Costa_Rica",
                  dateStyle: "medium",
                  timeStyle: "short",
                })} CR time
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <button
      class="submit-btn"
      on:click={submitOutcome}
      disabled={isLoading}
      type="button"
    >
      {#if isLoading}
        <span class="spinner"></span> Submitting...
      {:else}
        Submit Call Outcome
      {/if}
    </button>
  </div>
</div>

<style>
  :global(body) {
    background: #0f172a;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .agent-page {
    min-height: 100vh;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .agent-header {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    max-width: 680px;
  }

  .logo {
    height: 40px;
    border-radius: 6px;
  }

  .header-text h1 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: #f1f5f9;
  }

  .header-text p {
    margin: 2px 0 0;
    font-size: 0.875rem;
    color: #64748b;
  }

  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 1.25rem;
    padding: 2rem;
    width: 100%;
    max-width: 680px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .subtitle {
    margin: -0.75rem 0 0;
    font-size: 0.875rem;
    color: #94a3b8;
    line-height: 1.5;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .input,
  .textarea {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.75rem;
    color: #f1f5f9;
    font-size: 1rem;
    padding: 0.75rem 1rem;
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .input:focus,
  .textarea:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
  }

  .textarea {
    resize: vertical;
    min-height: 180px;
  }

  .hint {
    font-size: 0.75rem;
    color: #475569;
  }

  /* Toggle field */
  .toggle-field {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
  }

  .toggle-field--disabled {
    opacity: 0.4;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex: 1;
  }

  .toggle-label {
    font-size: 0.9rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  .toggle-description {
    font-size: 0.8rem;
    color: #64748b;
    line-height: 1.4;
  }

  .toggle {
    flex-shrink: 0;
    width: 52px;
    height: 28px;
    background: #334155;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    position: relative;
    transition: background 0.25s ease;
    margin-top: 2px;
  }

  .toggle--on {
    background: #0ea5e9;
  }

  .toggle:disabled {
    cursor: not-allowed;
  }

  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.25s ease;
    pointer-events: none;
  }

  .toggle--on .toggle-knob {
    transform: translateX(24px);
  }

  /* Outcome preview */
  .outcome-preview {
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    font-size: 0.875rem;
    color: #e2e8f0;
  }

  .outcome-preview strong {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .outcome-preview ul {
    margin: 0;
    padding: 0 0 0 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .outcome-preview--noshow {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .outcome-preview--quote {
    background: rgba(59, 130, 246, 0.08);
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  .outcome-preview--nurture {
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  /* Alerts */
  .alert {
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .alert--error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .alert--success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #86efac;
  }

  .scheduled-list {
    margin: 0.5rem 0 0;
    padding: 0 0 0 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .scheduled-list code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85em;
  }

  /* Submit button */
  .submit-btn {
    background: #0ea5e9;
    color: #fff;
    border: none;
    border-radius: 0.75rem;
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
  }

  .submit-btn:hover:not(:disabled) {
    background: #0284c7;
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
