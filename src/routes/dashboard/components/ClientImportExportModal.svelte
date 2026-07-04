<script lang="ts">
  /**
   * ClientImportExportModal.svelte
   * ────────────────────────────────────────────────────────────────────────
   * A single, softly-animated multi-step modal for BOTH exporting and importing
   * CRM clients as JSON. Lives in the List section of the dashboard.
   *
   *   • Export  — client-side. Serializes the current (filtered or all) clients
   *               to a round-trippable JSON envelope and downloads it.
   *   • Import  — server-backed two-phase flow:
   *                 1) dry-run  → validate + flag duplicates + advisory warnings
   *                              from the Overview Field Registry (the "headers"
   *                              come straight from Automations → Overview fields)
   *                 2) commit   → write into `consultations` (skip / merge /
   *                              overwrite per duplicate; audit trail + notes are
   *                              always APPEND-ONLY, never destroyed).
   *
   * The intermediate "checking" phase is where the operator is told exactly what
   * will be created vs. what already matches in the database.
   */
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import {
    clients,
    filteredClients,
    serializeClientExport,
    normalizeImportRecords,
    importClientsDryRun,
    importClientsCommit,
    type ImportStrategy,
    type ImportDryRunResult,
    type ImportCommitResult,
    type Client,
  } from '../store.ts';
  import { toasts } from '../toastStore.ts';
  import Select, { type SelectOption } from './ui/Select.svelte';

  /** 'import' or 'export' — set by the List-view button that opened us. */
  export let mode: 'import' | 'export' = 'export';

  const dispatch = createEventDispatcher<{ close: void; imported: void }>();

  // ── Export state ──────────────────────────────────────────────────────────
  type ExportScope = 'filtered' | 'all';
  let exportScope: ExportScope = 'filtered';
  let exportDone = false;

  $: exportList = exportScope === 'all' ? $clients : $filteredClients;
  $: exportCount = exportList.length;

  function downloadJson(text: string, filename: string) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function runExport() {
    const list: Client[] = exportList;
    if (list.length === 0) {
      toasts.error('No clients to export for the current scope.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const json = serializeClientExport(list);
    downloadJson(json, `irp-clients-${exportScope}-${stamp}.json`);
    exportDone = true;
    toasts.success(`Exported ${list.length} client${list.length === 1 ? '' : 's'}.`);
  }

  // ── Import state ──────────────────────────────────────────────────────────
  type ImportStep = 'input' | 'validating' | 'review' | 'importing' | 'done';
  let importStep: ImportStep = 'input';
  let rawText = '';
  let parseError = '';
  let dragOver = false;
  let records: any[] = [];
  let dryRun: ImportDryRunResult | null = null;
  let commitResult: ImportCommitResult | null = null;
  let defaultStrategy: ImportStrategy = 'skip';
  /** Per-docId strategy overrides for duplicates. */
  let strategies: Record<string, ImportStrategy> = {};

  const STRATEGY_OPTIONS: SelectOption[] = [
    { value: 'skip', label: 'Skip (keep existing)' },
    { value: 'merge', label: 'Merge (fill + update)' },
    { value: 'overwrite', label: 'Overwrite fields' },
  ];

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    rawText = await file.text();
    parseError = '';
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    rawText = await file.text();
    parseError = '';
  }

  function parseRecords(): any[] | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parseError = 'That is not valid JSON. Paste an exported file or a JSON array.';
      return null;
    }
    const recs = normalizeImportRecords(parsed);
    if (recs.length === 0) {
      parseError = 'No records found. Expected a JSON array or an { "clients": [...] } envelope.';
      return null;
    }
    parseError = '';
    return recs;
  }

  async function runValidate() {
    const recs = parseRecords();
    if (!recs) return;
    records = recs;
    importStep = 'validating';
    try {
      dryRun = await importClientsDryRun(records);
      // Seed per-duplicate strategy with the current default.
      strategies = {};
      for (const r of dryRun.records) {
        if (r.exists && r.docId) strategies[r.docId] = defaultStrategy;
      }
      importStep = 'review';
    } catch (err: any) {
      parseError = err?.message ?? 'Validation failed.';
      importStep = 'input';
    }
  }

  /** Re-apply the bulk default to every duplicate row. */
  function applyDefaultToAll() {
    if (!dryRun) return;
    const next: Record<string, ImportStrategy> = {};
    for (const r of dryRun.records) {
      if (r.exists && r.docId) next[r.docId] = defaultStrategy;
    }
    strategies = next;
  }

  $: newRecords = dryRun ? dryRun.records.filter((r) => r.valid && !r.exists) : [];
  $: duplicateRecords = dryRun ? dryRun.records.filter((r) => r.valid && r.exists) : [];
  $: invalidRecords = dryRun ? dryRun.records.filter((r) => !r.valid) : [];
  $: warnRecords = dryRun
    ? dryRun.records.filter((r) => r.missingRequired.length > 0 || r.warnings.length > 0)
    : [];

  /** How many records will actually be written given the chosen strategies. */
  $: willWrite = dryRun
    ? newRecords.length +
      duplicateRecords.filter((r) => (r.docId ? strategies[r.docId] : defaultStrategy) !== 'skip').length
    : 0;

  async function runCommit() {
    if (!dryRun || records.length === 0) return;
    importStep = 'importing';
    try {
      commitResult = await importClientsCommit(records, defaultStrategy, strategies);
      importStep = 'done';
      const { created, updated, skipped } = commitResult;
      toasts.success(`Import complete — ${created} created · ${updated} updated · ${skipped} skipped.`);
      dispatch('imported');
    } catch (err: any) {
      parseError = err?.message ?? 'Import failed.';
      importStep = 'review';
      toasts.error(`Import failed: ${err?.message ?? err}`);
    }
  }

  function resetImport() {
    importStep = 'input';
    rawText = '';
    parseError = '';
    records = [];
    dryRun = null;
    commitResult = null;
    strategies = {};
  }

  function close() {
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="iem-overlay" transition:fade={{ duration: 160 }} on:click|self={close}>
  <div class="iem-shell" transition:fly={{ y: 18, duration: 220 }}>
    <button class="iem-x" on:click={close} aria-label="Close">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>

    <!-- ══════════════════════════ EXPORT ══════════════════════════ -->
    {#if mode === 'export'}
      <header class="iem-head">
        <span class="iem-badge iem-badge--export">⬇ Export</span>
        <h2>Export clients to JSON</h2>
        <p class="iem-sub">A round-trippable backup you can re-import here anytime.</p>
      </header>

      {#if !exportDone}
        <div class="iem-body" in:fade={{ duration: 160 }}>
          <div class="iem-scope">
            <button
              class="iem-scope-card"
              class:active={exportScope === 'filtered'}
              on:click={() => (exportScope = 'filtered')}
            >
              <span class="iem-scope-title">Current view</span>
              <span class="iem-scope-count">{$filteredClients.length}</span>
              <span class="iem-scope-note">Respects your active filters &amp; search</span>
            </button>
            <button
              class="iem-scope-card"
              class:active={exportScope === 'all'}
              on:click={() => (exportScope = 'all')}
            >
              <span class="iem-scope-title">All clients</span>
              <span class="iem-scope-count">{$clients.length}</span>
              <span class="iem-scope-note">Full CRM snapshot</span>
            </button>
          </div>
        </div>

        <footer class="iem-foot">
          <button class="iem-btn" on:click={close}>Cancel</button>
          <button class="iem-btn iem-btn--primary" disabled={exportCount === 0} on:click={runExport}>
            Download {exportCount} record{exportCount === 1 ? '' : 's'}
          </button>
        </footer>
      {:else}
        <div class="iem-body iem-done" in:fade={{ duration: 200 }}>
          <div class="iem-done-icon">✅</div>
          <h3>Export downloaded</h3>
          <p class="iem-sub">{exportCount} record{exportCount === 1 ? '' : 's'} saved as JSON.</p>
        </div>
        <footer class="iem-foot">
          <button class="iem-btn iem-btn--primary" on:click={close}>Done</button>
        </footer>
      {/if}

    <!-- ══════════════════════════ IMPORT ══════════════════════════ -->
    {:else}
      <header class="iem-head">
        <span class="iem-badge iem-badge--import">⬆ Import</span>
        <h2>Import clients from JSON</h2>
        <p class="iem-sub">
          Fields are checked against your <strong>Overview fields</strong> config (Automations).
          Extra fields are always accepted — nothing is ever rejected.
        </p>
      </header>

      <!-- Step rail -->
      <div class="iem-rail" aria-hidden="true">
        {#each ['Upload', 'Check', 'Import'] as railLabel, i}
          {@const active =
            (importStep === 'input' && i === 0) ||
            ((importStep === 'validating' || importStep === 'review') && i === 1) ||
            ((importStep === 'importing' || importStep === 'done') && i === 2)}
          {@const passed =
            ((importStep === 'validating' || importStep === 'review' || importStep === 'importing' || importStep === 'done') && i === 0) ||
            ((importStep === 'importing' || importStep === 'done') && i === 1)}
          <div class="iem-rail-step" class:active class:passed>
            <span class="iem-rail-dot">{passed ? '✓' : i + 1}</span>
            <span class="iem-rail-label">{railLabel}</span>
          </div>
          {#if i < 2}<span class="iem-rail-line" class:passed></span>{/if}
        {/each}
      </div>

      <!-- ── STEP: input ── -->
      {#if importStep === 'input'}
        <div class="iem-body" in:fade={{ duration: 160 }}>
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="iem-drop"
            class:drag={dragOver}
            on:dragover|preventDefault={() => (dragOver = true)}
            on:dragleave={() => (dragOver = false)}
            on:drop={onDrop}
          >
            <div class="iem-drop-icon">📄</div>
            <p>Drop a <strong>.json</strong> file here, or</p>
            <label class="iem-file">
              Choose file
              <input type="file" accept="application/json,.json" on:change={onFile} />
            </label>
          </div>
          <div class="iem-or">— or paste JSON —</div>
          <textarea
            class="iem-textarea"
            rows="6"
            placeholder={'[\n  { "docId": "jane_doe_gmail_com", "dripEmail": "jane@doe.com", "consultations": [ ... ] }\n]'}
            bind:value={rawText}
          ></textarea>
          {#if parseError}<div class="iem-error" in:fade>{parseError}</div>{/if}
        </div>
        <footer class="iem-foot">
          <button class="iem-btn" on:click={close}>Cancel</button>
          <button class="iem-btn iem-btn--primary" disabled={!rawText.trim()} on:click={runValidate}>
            Check records →
          </button>
        </footer>

      <!-- ── STEP: validating ── -->
      {:else if importStep === 'validating'}
        <div class="iem-body iem-center" in:fade={{ duration: 160 }}>
          <div class="iem-spinner"></div>
          <p class="iem-sub">Checking {records.length} record{records.length === 1 ? '' : 's'} against the database…</p>
        </div>

      <!-- ── STEP: review (the intermediate checking phase) ── -->
      {:else if importStep === 'review' && dryRun}
        <div class="iem-body" in:fly={{ y: 10, duration: 200 }}>
          <div class="iem-stats">
            <div class="iem-stat iem-stat--new"><b>{newRecords.length}</b><span>New</span></div>
            <div class="iem-stat iem-stat--dup"><b>{duplicateRecords.length}</b><span>Already in DB</span></div>
            <div class="iem-stat iem-stat--warn"><b>{warnRecords.length}</b><span>With warnings</span></div>
            {#if invalidRecords.length}
              <div class="iem-stat iem-stat--bad"><b>{invalidRecords.length}</b><span>Unusable</span></div>
            {/if}
          </div>

          {#if duplicateRecords.length > 0}
            <div class="iem-dupbar">
              <span>{duplicateRecords.length} record{duplicateRecords.length === 1 ? '' : 's'} already exist. For all duplicates:</span>
              <div class="iem-dupbar-select">
                <Select
                  options={STRATEGY_OPTIONS}
                  bind:value={defaultStrategy}
                  on:change={applyDefaultToAll}
                  size="sm"
                  ariaLabel="Default strategy for all duplicates"
                />
              </div>
            </div>
          {/if}

          <div class="iem-table-wrap">
            <table class="iem-table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>On duplicate</th>
                </tr>
              </thead>
              <tbody>
                {#each dryRun.records as r (r.index)}
                  <tr class:bad={!r.valid}>
                    <td>
                      <div class="iem-rec-id">{r.email || r.docId || `record #${r.index + 1}`}</div>
                      {#if r.docId}<code class="iem-rec-docid">{r.docId}</code>{/if}
                    </td>
                    <td>
                      {#if !r.valid}
                        <span class="iem-pill iem-pill--bad">Unusable</span>
                      {:else if r.exists}
                        <span class="iem-pill iem-pill--dup">🔁 Duplicate</span>
                      {:else}
                        <span class="iem-pill iem-pill--new">🆕 New</span>
                      {/if}
                    </td>
                    <td>
                      {#if r.missingRequired.length}
                        <div class="iem-warn" title={r.missingRequired.join(', ')}>
                          ⚠ Missing: {r.missingRequired.join(', ')}
                        </div>
                      {/if}
                      {#if r.warnings.length}
                        <div class="iem-warn" title={r.warnings.join('\n')}>
                          ⚠ {r.warnings.length} type warning{r.warnings.length === 1 ? '' : 's'}
                        </div>
                      {/if}
                      {#if !r.valid}
                        <div class="iem-warn">{r.warnings[0] ?? 'No email / docId'}</div>
                      {/if}
                      {#if r.valid && !r.missingRequired.length && !r.warnings.length}
                        <span class="iem-ok">Looks good</span>
                      {/if}
                    </td>
                    <td>
                      {#if r.valid && r.exists && r.docId}
                        <div class="iem-row-select">
                          <Select
                            options={STRATEGY_OPTIONS}
                            bind:value={strategies[r.docId]}
                            size="sm"
                            ariaLabel="Strategy for this duplicate"
                          />
                        </div>
                      {:else}
                        <span class="iem-dash">—</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if parseError}<div class="iem-error" in:fade>{parseError}</div>{/if}
        </div>
        <footer class="iem-foot">
          <button class="iem-btn" on:click={resetImport}>← Back</button>
          <button class="iem-btn iem-btn--primary" disabled={willWrite === 0} on:click={runCommit}>
            Import {willWrite} record{willWrite === 1 ? '' : 's'}
          </button>
        </footer>

      <!-- ── STEP: importing ── -->
      {:else if importStep === 'importing'}
        <div class="iem-body iem-center" in:fade={{ duration: 160 }}>
          <div class="iem-spinner"></div>
          <p class="iem-sub">Writing to the database…</p>
        </div>

      <!-- ── STEP: done ── -->
      {:else if importStep === 'done' && commitResult}
        <div class="iem-body iem-done" in:fly={{ y: 10, duration: 200 }}>
          <div class="iem-done-icon">🎉</div>
          <h3>Import complete</h3>
          <div class="iem-stats">
            <div class="iem-stat iem-stat--new"><b>{commitResult.created}</b><span>Created</span></div>
            <div class="iem-stat iem-stat--dup"><b>{commitResult.updated}</b><span>Updated</span></div>
            <div class="iem-stat"><b>{commitResult.skipped}</b><span>Skipped</span></div>
            {#if commitResult.errors.length}
              <div class="iem-stat iem-stat--bad"><b>{commitResult.errors.length}</b><span>Errors</span></div>
            {/if}
          </div>
          {#if commitResult.errors.length}
            <div class="iem-errlist">
              {#each commitResult.errors.slice(0, 6) as e}
                <div class="iem-warn">#{e.index + 1} {e.docId ?? ''}: {e.error}</div>
              {/each}
              {#if commitResult.errors.length > 6}
                <div class="iem-sub">…and {commitResult.errors.length - 6} more.</div>
              {/if}
            </div>
          {/if}
        </div>
        <footer class="iem-foot">
          <button class="iem-btn" on:click={resetImport}>Import more</button>
          <button class="iem-btn iem-btn--primary" on:click={close}>Done</button>
        </footer>
      {/if}
    {/if}
  </div>
</div>

<style>
  .iem-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(6px);
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .iem-shell {
    position: relative;
    width: 100%;
    max-width: 760px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    box-shadow: 0 24px 72px rgba(15, 23, 42, 0.22);
    overflow: hidden;
  }
  .iem-x {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.15s;
  }
  .iem-x:hover { background: #eef2f7; color: #0f172a; transform: scale(1.08); }

  .iem-head {
    padding: 1.6rem 1.6rem 0.6rem;
  }
  .iem-badge {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    margin-bottom: 0.6rem;
  }
  .iem-badge--export { background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; }
  .iem-badge--import { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
  .iem-head h2 { margin: 0; font-size: 1.2rem; color: #0f172a; }
  .iem-sub { margin: 0.3rem 0 0; color: #64748b; font-size: 0.85rem; line-height: 1.5; }

  /* Step rail */
  .iem-rail {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.8rem 1.6rem 0;
  }
  .iem-rail-step { display: flex; align-items: center; gap: 0.4rem; opacity: 0.5; transition: opacity 0.2s; }
  .iem-rail-step.active, .iem-rail-step.passed { opacity: 1; }
  .iem-rail-dot {
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; font-weight: 800;
    background: #e2e8f0; color: #64748b;
    transition: background 0.2s, color 0.2s;
  }
  .iem-rail-step.active .iem-rail-dot { background: #02b5bb; color: #fff; }
  .iem-rail-step.passed .iem-rail-dot { background: #0e7490; color: #fff; }
  .iem-rail-label { font-size: 0.75rem; font-weight: 600; color: #475569; }
  .iem-rail-line { flex: 1; height: 2px; background: #e2e8f0; border-radius: 2px; }
  .iem-rail-line.passed { background: #0e7490; }

  .iem-body {
    padding: 1.2rem 1.6rem;
    overflow-y: auto;
    flex: 1;
  }
  .iem-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; min-height: 220px; }
  .iem-done { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.6rem; }
  .iem-done-icon { font-size: 2.6rem; }
  .iem-done h3 { margin: 0; color: #0f172a; }

  /* Export scope cards */
  .iem-scope { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
  .iem-scope-card {
    display: flex; flex-direction: column; gap: 0.25rem;
    padding: 1.1rem; text-align: left;
    background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px;
    cursor: pointer; transition: border-color 0.15s, background 0.15s, transform 0.12s;
  }
  .iem-scope-card:hover { transform: translateY(-1px); }
  .iem-scope-card.active { border-color: #02b5bb; background: #ecfeff; }
  .iem-scope-title { font-weight: 700; color: #0f172a; font-size: 0.92rem; }
  .iem-scope-count { font-size: 1.7rem; font-weight: 800; color: #0e7490; line-height: 1; }
  .iem-scope-note { font-size: 0.75rem; color: #64748b; }

  /* Drop zone */
  .iem-drop {
    border: 2px dashed #cbd5e1; border-radius: 14px;
    padding: 1.6rem; text-align: center; color: #64748b;
    transition: border-color 0.15s, background 0.15s;
  }
  .iem-drop.drag { border-color: #02b5bb; background: #ecfeff; }
  .iem-drop-icon { font-size: 1.8rem; margin-bottom: 0.3rem; }
  .iem-drop p { margin: 0.2rem 0 0.6rem; font-size: 0.85rem; }
  .iem-file {
    display: inline-block; padding: 0.45rem 0.9rem;
    background: #4338ca; color: #fff; border-radius: 8px;
    font-size: 0.82rem; font-weight: 600; cursor: pointer;
  }
  .iem-file input { display: none; }
  .iem-or { text-align: center; color: #94a3b8; font-size: 0.75rem; margin: 0.8rem 0; }
  .iem-textarea {
    width: 100%; box-sizing: border-box;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78rem; padding: 0.7rem;
    border: 1px solid #cbd5e1; border-radius: 10px; resize: vertical;
  }

  /* Stats */
  .iem-stats { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.9rem; }
  .iem-stat {
    display: flex; flex-direction: column; align-items: center;
    min-width: 82px; padding: 0.6rem 0.9rem;
    background: #f1f5f9; border-radius: 12px;
  }
  .iem-stat b { font-size: 1.3rem; color: #0f172a; }
  .iem-stat span { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
  .iem-stat--new { background: #ecfdf5; } .iem-stat--new b { color: #059669; }
  .iem-stat--dup { background: #eff6ff; } .iem-stat--dup b { color: #2563eb; }
  .iem-stat--warn { background: #fffbeb; } .iem-stat--warn b { color: #b45309; }
  .iem-stat--bad { background: #fef2f2; } .iem-stat--bad b { color: #b91c1c; }

  .iem-dupbar {
    display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
    background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;
    padding: 0.55rem 0.8rem; margin-bottom: 0.8rem;
    font-size: 0.82rem; color: #1e40af;
  }
  /* Constrain the custom <Select> so its trigger/menu can never be stretched
     by option content (same "fits content, no viewport collision" contract
     as the filters-bar — see +page.svelte). */
  .iem-dupbar-select { width: 190px; flex-shrink: 0; }
  .iem-row-select { width: 180px; }

  .iem-table-wrap { max-height: 320px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
  .iem-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .iem-table th {
    position: sticky; top: 0; background: #f8fafc; z-index: 1;
    text-align: left; padding: 0.5rem 0.7rem; color: #64748b;
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em;
    border-bottom: 2px solid #e2e8f0;
  }
  .iem-table td { padding: 0.5rem 0.7rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .iem-table tr.bad td { background: #fef2f2; }
  .iem-rec-id { font-weight: 600; color: #0f172a; }
  .iem-rec-docid { font-size: 0.66rem; color: #94a3b8; }
  .iem-pill { display: inline-block; font-size: 0.68rem; font-weight: 700; padding: 0.12rem 0.5rem; border-radius: 999px; white-space: nowrap; }
  .iem-pill--new { background: #d1fae5; color: #065f46; }
  .iem-pill--dup { background: #dbeafe; color: #1e40af; }
  .iem-pill--bad { background: #fee2e2; color: #991b1b; }
  .iem-warn { color: #b45309; font-size: 0.72rem; line-height: 1.4; }
  .iem-ok { color: #16a34a; font-size: 0.72rem; }
  .iem-dash { color: #cbd5e1; }
  .iem-errlist { width: 100%; margin-top: 0.4rem; }

  .iem-error {
    margin-top: 0.7rem; background: #fef2f2; color: #b91c1c;
    border: 1px solid #fecaca; border-radius: 8px; padding: 0.5rem 0.7rem; font-size: 0.8rem;
  }

  .iem-spinner {
    width: 40px; height: 40px; border-radius: 50%;
    border: 3px solid #e2e8f0; border-top-color: #02b5bb;
    animation: iem-spin 0.8s linear infinite;
  }
  @keyframes iem-spin { to { transform: rotate(360deg); } }

  .iem-foot {
    display: flex; justify-content: flex-end; gap: 0.6rem;
    padding: 1rem 1.6rem; border-top: 1px solid #eef2f7; background: #fbfdff;
  }
  .iem-btn {
    padding: 0.5rem 1.05rem; border-radius: 9px;
    border: 1px solid #cbd5e1; background: #fff; color: #334155;
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: background 0.15s, transform 0.12s, box-shadow 0.15s;
  }
  .iem-btn:hover:not(:disabled) { background: #f1f5f9; }
  .iem-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .iem-btn--primary {
    background: linear-gradient(135deg, #02b5bb 0%, #0a8a8e 100%);
    border-color: transparent; color: #fff;
    box-shadow: 0 3px 12px rgba(2, 181, 187, 0.32);
  }
  .iem-btn--primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(2, 181, 187, 0.42); }

  @media (max-width: 560px) {
    .iem-scope { grid-template-columns: 1fr; }
    .iem-table th:nth-child(3), .iem-table td:nth-child(3) { display: none; }
  }
</style>
