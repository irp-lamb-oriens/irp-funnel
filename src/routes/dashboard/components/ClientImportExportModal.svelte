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
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicOut, elasticOut } from 'svelte/easing';
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

  /** Presentational only — drives the glowing gradient fill of the step rail. */
  $: railProgress =
    importStep === 'input'
      ? 0
      : importStep === 'validating' || importStep === 'review'
      ? 50
      : 100;

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
<div class="iem-overlay" transition:fade={{ duration: 180 }} on:click|self={close}>
  <div class="iem-shell" transition:fly={{ y: 22, duration: 280, easing: cubicOut }}>
    <button class="iem-x" on:click={close} aria-label="Close">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>

    <!-- ══════════════════════════ EXPORT ══════════════════════════ -->
    {#if mode === 'export'}
      <header class="iem-head">
        <div class="iem-icon-badge iem-icon-badge--export" aria-hidden="true">
          <span class="iem-icon-badge__ring"></span>
          <span class="iem-icon-badge__glyph">⬇</span>
        </div>
        <div class="iem-head-text">
          <span class="iem-badge iem-badge--export">Export</span>
          <h2>Export clients to JSON</h2>
          <p class="iem-sub">A round-trippable backup you can re-import here anytime.</p>
        </div>
      </header>

      {#if !exportDone}
        <div class="iem-body" in:fade={{ duration: 180 }}>
          <div class="iem-scope">
            <button
              class="iem-scope-card"
              class:active={exportScope === 'filtered'}
              on:click={() => (exportScope = 'filtered')}
            >
              {#if exportScope === 'filtered'}
                <span class="iem-scope-check" in:scale={{ duration: 220, easing: elasticOut }}>✓</span>
              {/if}
              <span class="iem-scope-icon">🔎</span>
              <span class="iem-scope-title">Current view</span>
              <span class="iem-scope-count">{$filteredClients.length}</span>
              <span class="iem-scope-note">Respects your active filters &amp; search</span>
            </button>
            <button
              class="iem-scope-card"
              class:active={exportScope === 'all'}
              on:click={() => (exportScope = 'all')}
            >
              {#if exportScope === 'all'}
                <span class="iem-scope-check" in:scale={{ duration: 220, easing: elasticOut }}>✓</span>
              {/if}
              <span class="iem-scope-icon">🗂️</span>
              <span class="iem-scope-title">All clients</span>
              <span class="iem-scope-count">{$clients.length}</span>
              <span class="iem-scope-note">Full CRM snapshot</span>
            </button>
          </div>
        </div>

        <footer class="iem-foot">
          <button class="iem-btn" on:click={close}>Cancel</button>
          <button class="iem-btn iem-btn--primary" disabled={exportCount === 0} on:click={runExport}>
            <span class="iem-btn__shine" aria-hidden="true"></span>
            <span class="iem-btn__label">⬇ Download {exportCount} record{exportCount === 1 ? '' : 's'}</span>
          </button>
        </footer>
      {:else}
        <div class="iem-body iem-done" in:fly={{ y: 8, duration: 260, easing: cubicOut }}>
          <div class="iem-done-icon-wrap">
            <span class="iem-done-ring iem-done-ring--1"></span>
            <span class="iem-done-ring iem-done-ring--2"></span>
            <span class="iem-done-icon">✅</span>
          </div>
          <h3>Export downloaded</h3>
          <p class="iem-sub">{exportCount} record{exportCount === 1 ? '' : 's'} saved as JSON.</p>
        </div>
        <footer class="iem-foot">
          <button class="iem-btn iem-btn--primary" on:click={close}>
            <span class="iem-btn__shine" aria-hidden="true"></span>
            <span class="iem-btn__label">Done</span>
          </button>
        </footer>
      {/if}

    <!-- ══════════════════════════ IMPORT ══════════════════════════ -->
    {:else}
      <header class="iem-head">
        <div class="iem-icon-badge iem-icon-badge--import" aria-hidden="true">
          <span class="iem-icon-badge__ring"></span>
          <span class="iem-icon-badge__glyph">⬆</span>
        </div>
        <div class="iem-head-text">
          <span class="iem-badge iem-badge--import">Import</span>
          <h2>Import clients from JSON</h2>
          <p class="iem-sub">
            Fields are checked against your <strong>Overview fields</strong> config (Automations).
            Extra fields are always accepted — nothing is ever rejected.
          </p>
        </div>
      </header>

      <!-- Step rail -->
      <div class="iem-rail" aria-hidden="true">
        <div class="iem-rail-track">
          <div class="iem-rail-fill" style="width: {railProgress}%"></div>
        </div>
        <div class="iem-rail-steps">
          {#each ['Upload', 'Check', 'Import'] as railLabel, i}
            {@const active =
              (importStep === 'input' && i === 0) ||
              ((importStep === 'validating' || importStep === 'review') && i === 1) ||
              ((importStep === 'importing' || importStep === 'done') && i === 2)}
            {@const passed =
              ((importStep === 'validating' || importStep === 'review' || importStep === 'importing' || importStep === 'done') && i === 0) ||
              ((importStep === 'importing' || importStep === 'done') && i === 1)}
            <div class="iem-rail-step" class:active class:passed>
              <span class="iem-rail-dot">
                {#if active}<span class="iem-rail-dot__pulse"></span>{/if}
                {passed ? '✓' : i + 1}
              </span>
              <span class="iem-rail-label">{railLabel}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- ── STEP: input ── -->
      {#if importStep === 'input'}
        <div class="iem-body" in:fade={{ duration: 180 }}>
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="iem-drop"
            class:drag={dragOver}
            on:dragover|preventDefault={() => (dragOver = true)}
            on:dragleave={() => (dragOver = false)}
            on:drop={onDrop}
          >
            <div class="iem-drop-icon">
              <span class="iem-drop-icon__bounce">📤</span>
            </div>
            <p>Drop a <strong>.json</strong> file here, or</p>
            <label class="iem-file">
              <span class="iem-btn__shine" aria-hidden="true"></span>
              <span class="iem-file__label">Choose file</span>
              <input type="file" accept="application/json,.json" on:change={onFile} />
            </label>
          </div>
          <div class="iem-or"><span>or paste JSON</span></div>
          <textarea
            class="iem-textarea"
            rows="6"
            placeholder={'[\n  { "docId": "jane_doe_gmail_com", "dripEmail": "jane@doe.com", "consultations": [ ... ] }\n]'}
            bind:value={rawText}
          ></textarea>
          {#if parseError}<div class="iem-error" in:fade>⚠️ {parseError}</div>{/if}
        </div>
        <footer class="iem-foot">
          <button class="iem-btn" on:click={close}>Cancel</button>
          <button class="iem-btn iem-btn--primary" disabled={!rawText.trim()} on:click={runValidate}>
            <span class="iem-btn__shine" aria-hidden="true"></span>
            <span class="iem-btn__label">Check records →</span>
          </button>
        </footer>

      <!-- ── STEP: validating ── -->
      {:else if importStep === 'validating'}
        <div class="iem-body iem-center" in:fade={{ duration: 180 }}>
          <div class="iem-cosmos">
            <div class="iem-cosmos-orbit iem-cosmos-orbit-1"></div>
            <div class="iem-cosmos-orbit iem-cosmos-orbit-2"></div>
            <div class="iem-cosmos-orbit iem-cosmos-orbit-3"></div>
            <div class="iem-cosmos-core">🔎</div>
          </div>
          <p class="iem-sub iem-sub--center">
            Checking <strong>{records.length}</strong> record{records.length === 1 ? '' : 's'} against the database…
          </p>
        </div>

      <!-- ── STEP: review (the intermediate checking phase) ── -->
      {:else if importStep === 'review' && dryRun}
        <div class="iem-body" in:fly={{ y: 12, duration: 220, easing: cubicOut }}>
          <div class="iem-stats">
            <div class="iem-stat iem-stat--new">
              <span class="iem-stat__icon">🆕</span>
              <b>{newRecords.length}</b><span>New</span>
            </div>
            <div class="iem-stat iem-stat--dup">
              <span class="iem-stat__icon">🔁</span>
              <b>{duplicateRecords.length}</b><span>Already in DB</span>
            </div>
            <div class="iem-stat iem-stat--warn">
              <span class="iem-stat__icon">⚠️</span>
              <b>{warnRecords.length}</b><span>With warnings</span>
            </div>
            {#if invalidRecords.length}
              <div class="iem-stat iem-stat--bad">
                <span class="iem-stat__icon">❌</span>
                <b>{invalidRecords.length}</b><span>Unusable</span>
              </div>
            {/if}
          </div>

          {#if duplicateRecords.length > 0}
            <div class="iem-dupbar">
              <span class="iem-dupbar__icon">🔁</span>
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
                        <span class="iem-pill iem-pill--bad"><span class="iem-dot"></span>Unusable</span>
                      {:else if r.exists}
                        <span class="iem-pill iem-pill--dup"><span class="iem-dot"></span>Duplicate</span>
                      {:else}
                        <span class="iem-pill iem-pill--new"><span class="iem-dot"></span>New</span>
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
                        <span class="iem-ok">✓ Looks good</span>
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
          {#if parseError}<div class="iem-error" in:fade>⚠️ {parseError}</div>{/if}
        </div>
        <footer class="iem-foot">
          <button class="iem-btn" on:click={resetImport}>← Back</button>
          <button class="iem-btn iem-btn--primary" disabled={willWrite === 0} on:click={runCommit}>
            <span class="iem-btn__shine" aria-hidden="true"></span>
            <span class="iem-btn__label">Import {willWrite} record{willWrite === 1 ? '' : 's'}</span>
          </button>
        </footer>

      <!-- ── STEP: importing ── -->
      {:else if importStep === 'importing'}
        <div class="iem-body iem-center" in:fade={{ duration: 180 }}>
          <div class="iem-cosmos">
            <div class="iem-cosmos-orbit iem-cosmos-orbit-1"></div>
            <div class="iem-cosmos-orbit iem-cosmos-orbit-2"></div>
            <div class="iem-cosmos-orbit iem-cosmos-orbit-3"></div>
            <div class="iem-cosmos-core">💾</div>
          </div>
          <p class="iem-sub iem-sub--center">Writing to the database…</p>
        </div>

      <!-- ── STEP: done ── -->
      {:else if importStep === 'done' && commitResult}
        <div class="iem-body iem-done" in:fly={{ y: 12, duration: 260, easing: cubicOut }}>
          <div class="iem-done-icon-wrap">
            <span class="iem-done-ring iem-done-ring--1"></span>
            <span class="iem-done-ring iem-done-ring--2"></span>
            <span class="iem-done-icon">🎉</span>
          </div>
          <h3>Import complete</h3>
          <div class="iem-stats">
            <div class="iem-stat iem-stat--new">
              <span class="iem-stat__icon">✨</span>
              <b>{commitResult.created}</b><span>Created</span>
            </div>
            <div class="iem-stat iem-stat--dup">
              <span class="iem-stat__icon">♻️</span>
              <b>{commitResult.updated}</b><span>Updated</span>
            </div>
            <div class="iem-stat">
              <span class="iem-stat__icon">⏭️</span>
              <b>{commitResult.skipped}</b><span>Skipped</span>
            </div>
            {#if commitResult.errors.length}
              <div class="iem-stat iem-stat--bad">
                <span class="iem-stat__icon">❌</span>
                <b>{commitResult.errors.length}</b><span>Errors</span>
              </div>
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
          <button class="iem-btn iem-btn--primary" on:click={close}>
            <span class="iem-btn__shine" aria-hidden="true"></span>
            <span class="iem-btn__label">Done</span>
          </button>
        </footer>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* ══════════════════════════════════════════════════════════════════════
     OVERLAY + SHELL
  ══════════════════════════════════════════════════════════════════════ */
  .iem-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at 30% 20%, rgba(67, 56, 202, 0.16), transparent 55%),
      rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(8px) saturate(1.1);
    -webkit-backdrop-filter: blur(8px) saturate(1.1);
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .iem-shell {
    position: relative;
    width: 100%;
    max-width: 780px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 26px;
    box-shadow: 0 32px 90px rgba(15, 23, 42, 0.28), 0 8px 28px rgba(2, 181, 187, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
    overflow: hidden;
  }
  .iem-shell::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #02b5bb 0%, #4338ca 50%, #02b5bb 100%);
    background-size: 200% 100%;
    animation: iem-shimmer-bar 3.6s linear infinite;
  }
  @keyframes iem-shimmer-bar {
    to { background-position: -200% 0; }
  }

  .iem-x {
    position: absolute;
    top: 1.1rem;
    right: 1.1rem;
    z-index: 5;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    transition: background 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s;
  }
  .iem-x:hover {
    background: #fef2f2;
    color: #ef4444;
    border-color: #fecaca;
    transform: scale(1.1) rotate(90deg);
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.2);
  }

  /* ══════════════════════════════════════════════════════════════════════
     HEADER
  ══════════════════════════════════════════════════════════════════════ */
  .iem-head {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.9rem 3rem 0.9rem 1.8rem;
  }
  .iem-icon-badge {
    position: relative;
    flex-shrink: 0;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    color: #fff;
  }
  .iem-icon-badge--export { background: linear-gradient(135deg, #06b6d4 0%, #02b5bb 55%, #0e7490 100%); }
  .iem-icon-badge--import { background: linear-gradient(135deg, #818cf8 0%, #4338ca 55%, #3730a3 100%); }
  .iem-icon-badge__glyph {
    position: relative;
    z-index: 1;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
  }
  .iem-icon-badge__ring {
    position: absolute;
    inset: -6px;
    border-radius: 20px;
    border: 1.5px solid currentColor;
    opacity: 0.25;
    animation: iem-badge-pulse 2.6s ease-in-out infinite;
  }
  .iem-icon-badge--export .iem-icon-badge__ring { color: #02b5bb; }
  .iem-icon-badge--import .iem-icon-badge__ring { color: #4338ca; }
  @keyframes iem-badge-pulse {
    0%, 100% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.12); opacity: 0; }
  }

  .iem-head-text { flex: 1; min-width: 0; }
  .iem-badge {
    display: inline-block;
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.18rem 0.6rem;
    border-radius: 999px;
    margin-bottom: 0.45rem;
  }
  .iem-badge--export { background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; }
  .iem-badge--import { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
  .iem-head h2 { margin: 0; font-size: 1.28rem; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; }
  .iem-sub { margin: 0.35rem 0 0; color: #64748b; font-size: 0.85rem; line-height: 1.55; }
  .iem-sub--center { text-align: center; }

  /* ══════════════════════════════════════════════════════════════════════
     STEP RAIL
  ══════════════════════════════════════════════════════════════════════ */
  .iem-rail { padding: 0.6rem 1.8rem 0; }
  .iem-rail-track {
    position: relative;
    height: 3px;
    border-radius: 3px;
    background: #eef2f7;
    margin: 0 22px;
    overflow: hidden;
  }
  .iem-rail-fill {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #02b5bb, #4338ca);
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .iem-rail-steps {
    display: flex;
    justify-content: space-between;
    margin-top: -13px;
  }
  .iem-rail-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    opacity: 0.5;
    transition: opacity 0.25s;
  }
  .iem-rail-step.active, .iem-rail-step.passed { opacity: 1; }
  .iem-rail-dot {
    position: relative;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 800;
    background: #fff;
    border: 2px solid #e2e8f0;
    color: #94a3b8;
    transition: background 0.25s, color 0.25s, border-color 0.25s, transform 0.25s;
  }
  .iem-rail-step.active .iem-rail-dot {
    background: linear-gradient(135deg, #02b5bb, #4338ca);
    border-color: transparent;
    color: #fff;
    transform: scale(1.12);
    box-shadow: 0 4px 14px rgba(67, 56, 202, 0.35);
  }
  .iem-rail-step.passed .iem-rail-dot {
    background: #ecfeff;
    border-color: #a5f3fc;
    color: #0e7490;
  }
  .iem-rail-dot__pulse {
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 2px solid #4338ca;
    opacity: 0.5;
    animation: iem-dot-pulse 1.6s ease-out infinite;
  }
  @keyframes iem-dot-pulse {
    0% { transform: scale(0.9); opacity: 0.55; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  .iem-rail-label { font-size: 0.72rem; font-weight: 700; color: #475569; letter-spacing: 0.01em; }
  .iem-rail-step.active .iem-rail-label { color: #3730a3; }

  /* ══════════════════════════════════════════════════════════════════════
     BODY / GENERIC
  ══════════════════════════════════════════════════════════════════════ */
  .iem-body {
    padding: 1.3rem 1.8rem;
    overflow-y: auto;
    flex: 1;
  }
  .iem-body::-webkit-scrollbar { width: 8px; }
  .iem-body::-webkit-scrollbar-thumb { background: rgba(2, 181, 187, 0.22); border-radius: 8px; }
  .iem-body::-webkit-scrollbar-track { background: transparent; }

  .iem-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.4rem; min-height: 260px; }
  .iem-done { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.6rem; }
  .iem-done h3 { margin: 0.3rem 0 0; color: #0f172a; font-size: 1.15rem; font-weight: 800; }

  .iem-done-icon-wrap {
    position: relative;
    width: 84px;
    height: 84px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .iem-done-icon {
    position: relative;
    z-index: 1;
    font-size: 3rem;
    animation: iem-done-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes iem-done-pop {
    0% { transform: scale(0.3) rotate(-15deg); opacity: 0; }
    60% { transform: scale(1.15) rotate(4deg); opacity: 1; }
    100% { transform: scale(1) rotate(0); }
  }
  .iem-done-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(2, 181, 187, 0.35);
    animation: iem-done-ring-out 1.8s ease-out infinite;
  }
  .iem-done-ring--2 { animation-delay: 0.5s; border-color: rgba(67, 56, 202, 0.3); }
  @keyframes iem-done-ring-out {
    0% { transform: scale(0.6); opacity: 0.7; }
    100% { transform: scale(1.7); opacity: 0; }
  }

  /* ══════════════════════════════════════════════════════════════════════
     EXPORT SCOPE CARDS
  ══════════════════════════════════════════════════════════════════════ */
  .iem-scope { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .iem-scope-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 1.3rem 1.2rem;
    text-align: left;
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    border: 1.5px solid #e2e8f0;
    border-radius: 18px;
    cursor: pointer;
    transition: border-color 0.18s, background 0.18s, transform 0.15s, box-shadow 0.18s;
    overflow: hidden;
  }
  .iem-scope-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.1);
  }
  .iem-scope-card.active {
    border-color: #02b5bb;
    background: linear-gradient(160deg, #ecfeff 0%, #f0fdfe 60%, #eef2ff 100%);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.14), 0 12px 28px rgba(2, 181, 187, 0.16);
  }
  .iem-scope-icon { font-size: 1.4rem; }
  .iem-scope-check {
    position: absolute;
    top: 0.7rem;
    right: 0.8rem;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: linear-gradient(135deg, #02b5bb, #0e7490);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 800;
    box-shadow: 0 3px 10px rgba(2, 181, 187, 0.4);
  }
  .iem-scope-title { font-weight: 700; color: #0f172a; font-size: 0.94rem; }
  .iem-scope-count {
    font-size: 1.9rem;
    font-weight: 800;
    line-height: 1;
    background: linear-gradient(135deg, #0e7490, #4338ca);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .iem-scope-note { font-size: 0.74rem; color: #64748b; }

  /* ══════════════════════════════════════════════════════════════════════
     DROP ZONE + FILE INPUT
  ══════════════════════════════════════════════════════════════════════ */
  .iem-drop {
    position: relative;
    border: 2px dashed #cbd5e1;
    border-radius: 18px;
    padding: 2rem 1.6rem;
    text-align: center;
    color: #64748b;
    background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }
  .iem-drop.drag {
    border-color: #02b5bb;
    background: linear-gradient(180deg, #ecfeff 0%, #f0fdfe 100%);
    box-shadow: 0 0 0 4px rgba(2, 181, 187, 0.12);
  }
  .iem-drop-icon { margin-bottom: 0.4rem; }
  .iem-drop-icon__bounce {
    display: inline-block;
    font-size: 2.1rem;
    animation: iem-float 2.6s ease-in-out infinite;
  }
  @keyframes iem-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-7px); }
  }
  .iem-drop p { margin: 0.2rem 0 0.7rem; font-size: 0.86rem; }
  .iem-file {
    position: relative;
    display: inline-flex;
    align-items: center;
    overflow: hidden;
    padding: 0.55rem 1.15rem;
    background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
    color: #fff;
    border-radius: 10px;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(67, 56, 202, 0.32);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .iem-file:hover { transform: translateY(-1px); box-shadow: 0 7px 20px rgba(67, 56, 202, 0.42); }
  .iem-file input { display: none; }
  .iem-or {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: #94a3b8;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 1rem 0;
  }
  .iem-or::before, .iem-or::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }
  .iem-textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78rem;
    padding: 0.85rem;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    resize: vertical;
    background: #fbfdff;
    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
  }
  .iem-textarea:focus {
    outline: none;
    border-color: #02b5bb;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(2, 181, 187, 0.12);
  }

  /* ══════════════════════════════════════════════════════════════════════
     COSMIC SPINNER (validating / importing)
  ══════════════════════════════════════════════════════════════════════ */
  .iem-cosmos {
    position: relative;
    width: 96px;
    height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .iem-cosmos-orbit { position: absolute; border-radius: 50%; border: 2px solid transparent; }
  .iem-cosmos-orbit-1 {
    inset: 0;
    border-top-color: #4338ca;
    border-right-color: rgba(67, 56, 202, 0.3);
    animation: iem-cw 1.1s linear infinite;
  }
  .iem-cosmos-orbit-2 {
    inset: -12px;
    border-top-color: rgba(2, 181, 187, 0.65);
    border-left-color: rgba(2, 181, 187, 0.28);
    animation: iem-ccw 1.85s linear infinite;
  }
  .iem-cosmos-orbit-3 {
    inset: -26px;
    border-top-color: rgba(129, 140, 248, 0.35);
    border-bottom-color: rgba(129, 140, 248, 0.16);
    animation: iem-cw 3s linear infinite;
  }
  .iem-cosmos-core {
    position: relative;
    z-index: 1;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.35rem;
    background: radial-gradient(135% 135% at 30% 25%, #eef2ff 0%, #e0e7ff 45%, #c7d2fe 100%);
    box-shadow: 0 0 22px rgba(67, 56, 202, 0.32), 0 0 48px rgba(2, 181, 187, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.85);
    animation: iem-core-pulse 2s ease-in-out infinite;
  }
  @keyframes iem-cw { to { transform: rotate(360deg); } }
  @keyframes iem-ccw { to { transform: rotate(-360deg); } }
  @keyframes iem-core-pulse {
    0%, 100% { box-shadow: 0 0 22px rgba(67, 56, 202, 0.32), 0 0 48px rgba(2, 181, 187, 0.14), inset 0 1px 0 rgba(255,255,255,.85); }
    50% { box-shadow: 0 0 32px rgba(67, 56, 202, 0.5), 0 0 66px rgba(2, 181, 187, 0.22), inset 0 1px 0 rgba(255,255,255,.85); }
  }

  /* ══════════════════════════════════════════════════════════════════════
     STATS CARDS
  ══════════════════════════════════════════════════════════════════════ */
  .iem-stats { display: flex; flex-wrap: wrap; gap: 0.7rem; margin-bottom: 1rem; }
  .iem-stat {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-width: 92px;
    padding: 0.75rem 1rem;
    background: #f1f5f9;
    border-radius: 14px;
    border: 1px solid transparent;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .iem-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08); }
  .iem-stat__icon { font-size: 1.05rem; margin-bottom: 0.1rem; }
  .iem-stat b { font-size: 1.4rem; color: #0f172a; line-height: 1.1; }
  .iem-stat span { font-size: 0.68rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
  .iem-stat--new { background: linear-gradient(160deg, #ecfdf5 0%, #f0fdf9 100%); border-color: #bbf7d0; } .iem-stat--new b { color: #059669; }
  .iem-stat--dup { background: linear-gradient(160deg, #eff6ff 0%, #f5f8ff 100%); border-color: #bfdbfe; } .iem-stat--dup b { color: #2563eb; }
  .iem-stat--warn { background: linear-gradient(160deg, #fffbeb 0%, #fffdf5 100%); border-color: #fde68a; } .iem-stat--warn b { color: #b45309; }
  .iem-stat--bad { background: linear-gradient(160deg, #fef2f2 0%, #fff5f5 100%); border-color: #fecaca; } .iem-stat--bad b { color: #b91c1c; }

  .iem-dupbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    background: linear-gradient(135deg, #eff6ff 0%, #f5f8ff 100%);
    border: 1px solid #bfdbfe;
    border-radius: 14px;
    padding: 0.65rem 0.9rem;
    margin-bottom: 0.9rem;
    font-size: 0.82rem;
    color: #1e40af;
  }
  .iem-dupbar__icon { font-size: 1rem; }
  .iem-dupbar-select { width: 190px; flex-shrink: 0; }
  .iem-row-select { width: 180px; }

  /* ══════════════════════════════════════════════════════════════════════
     RESULTS TABLE
  ══════════════════════════════════════════════════════════════════════ */
  .iem-table-wrap {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.04);
  }
  .iem-table-wrap::-webkit-scrollbar { width: 8px; }
  .iem-table-wrap::-webkit-scrollbar-thumb { background: rgba(2, 181, 187, 0.22); border-radius: 8px; }
  .iem-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .iem-table th {
    position: sticky;
    top: 0;
    background: linear-gradient(180deg, #f8fafc, #f1f5f9);
    backdrop-filter: blur(4px);
    z-index: 1;
    text-align: left;
    padding: 0.6rem 0.8rem;
    color: #64748b;
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 800;
    border-bottom: 2px solid #e2e8f0;
  }
  .iem-table td { padding: 0.55rem 0.8rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .iem-table tbody tr { transition: background 0.12s; }
  .iem-table tbody tr:hover { background: #f8fafc; }
  .iem-table tr.bad td { background: #fef2f2; }
  .iem-table tr.bad:hover td { background: #fee9e9; }
  .iem-rec-id { font-weight: 700; color: #0f172a; }
  .iem-rec-docid { font-size: 0.65rem; color: #94a3b8; }
  .iem-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    margin-right: 5px;
  }
  .iem-pill {
    display: inline-flex;
    align-items: center;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.18rem 0.6rem;
    border-radius: 999px;
    white-space: nowrap;
  }
  .iem-pill--new { background: #d1fae5; color: #065f46; }
  .iem-pill--dup { background: #dbeafe; color: #1e40af; }
  .iem-pill--bad { background: #fee2e2; color: #991b1b; }
  .iem-warn { color: #b45309; font-size: 0.72rem; line-height: 1.4; }
  .iem-ok { color: #16a34a; font-size: 0.72rem; font-weight: 600; }
  .iem-dash { color: #cbd5e1; }
  .iem-errlist { width: 100%; margin-top: 0.5rem; }

  .iem-error {
    margin-top: 0.8rem;
    background: linear-gradient(135deg, #fef2f2, #fff5f5);
    color: #b91c1c;
    border: 1px solid #fecaca;
    border-radius: 12px;
    padding: 0.6rem 0.8rem;
    font-size: 0.8rem;
  }

  /* ══════════════════════════════════════════════════════════════════════
     FOOTER + BUTTONS
  ══════════════════════════════════════════════════════════════════════ */
  .iem-foot {
    display: flex;
    justify-content: flex-end;
    gap: 0.7rem;
    padding: 1.1rem 1.8rem;
    border-top: 1px solid #eef2f7;
    background: linear-gradient(180deg, #fbfdff, #f8fafc);
  }
  .iem-btn {
    position: relative;
    overflow: hidden;
    padding: 0.55rem 1.15rem;
    border-radius: 11px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #334155;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, transform 0.12s, box-shadow 0.15s, border-color 0.15s;
  }
  .iem-btn:hover:not(:disabled) { background: #f1f5f9; border-color: #94a3b8; transform: translateY(-1px); }
  .iem-btn:active:not(:disabled) { transform: translateY(0); }
  .iem-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .iem-btn--primary {
    background: linear-gradient(135deg, #02b5bb 0%, #0a8a8e 55%, #0e7490 100%);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 4px 16px rgba(2, 181, 187, 0.36);
  }
  .iem-btn--primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(2, 181, 187, 0.48);
    filter: brightness(1.05);
  }
  .iem-btn__label { position: relative; z-index: 1; }
  .iem-btn__shine {
    position: absolute;
    top: 0;
    left: -60%;
    width: 40%;
    height: 100%;
    background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.5), transparent);
    transform: skewX(-20deg);
    transition: left 0.6s ease;
    pointer-events: none;
  }
  .iem-btn--primary:hover .iem-btn__shine,
  .iem-file:hover .iem-btn__shine { left: 130%; }

  @media (max-width: 560px) {
    .iem-scope { grid-template-columns: 1fr; }
    .iem-table th:nth-child(3), .iem-table td:nth-child(3) { display: none; }
    .iem-head { padding-right: 2.6rem; }
  }
</style>
