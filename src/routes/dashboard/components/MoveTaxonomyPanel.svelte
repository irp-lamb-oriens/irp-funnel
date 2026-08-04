<script lang="ts">
  /**
   * MoveTaxonomyPanel — edit the vocabulary every price report groups by.
   *
   * Three lists and one number, held in `config/moveTaxonomy`. The Qwilr
   * analysis pipeline reads the same document, so a category added here is a
   * category the categorizer is allowed to assign on its next run. These values
   * used to live in a script, which meant changing them was a code change.
   *
   * Keys are stored lowercase with underscores because that is what the quote
   * rows already contain. Typing "Air Freight" therefore saves `air_freight`,
   * and the editor shows what will actually be stored rather than surprising
   * the operator after the save.
   */
  import { onMount } from 'svelte';
  import {
    moveTaxonomy,
    moveTaxonomySeed,
    fetchMoveTaxonomy,
    saveMoveTaxonomy,
    TaxonomyConflict,
    type MoveTaxonomy,
  } from '../store.ts';

  type ListKey = 'modalities' | 'packingTiers' | 'cargoTypes';

  const LISTS: Array<{ key: ListKey; title: string; hint: string }> = [
    {
      key: 'modalities',
      title: 'Modalities',
      hint: 'How the shipment travels. A full container and shared container space are different prices, so they are different modalities.',
    },
    {
      key: 'packingTiers',
      title: 'Packing tiers',
      hint: 'Who packs and who loads.',
    },
    {
      key: 'cargoTypes',
      title: 'Cargo types',
      hint: 'What is in the shipment. Kept separate from the modality because historical quotes state the container size far more often than the contents.',
    },
  ];

  let draft: MoveTaxonomy | null = null;
  let loading = false;
  let saving = false;
  let errorMsg = '';
  let savedMsg = '';
  /**
   * True when the last save was refused because someone else had edited the
   * document. The operator keeps their draft and decides whether to overwrite.
   */
  let conflict = false;
  /** New-key input per list, so three lists do not share one box. */
  let additions: Record<ListKey, string> = {
    modalities: '',
    packingTiers: '',
    cargoTypes: '',
  };

  /** The stored form of a typed key. Shown live so there are no surprises. */
  function toKey(raw: string): string {
    return raw.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 60);
  }

  /**
   * Reloading replaces the draft, so an unsaved edit would vanish. Reload only
   * discards work the operator explicitly agreed to discard.
   */
  async function load(force = false): Promise<void> {
    if (!force && dirty && !confirm('Discard your unsaved changes and reload?')) return;

    loading = true;
    errorMsg = '';
    try {
      const t = await fetchMoveTaxonomy();
      draft = structuredClone(t);
      conflict = false;
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not read the taxonomy.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if ($moveTaxonomy) draft = structuredClone($moveTaxonomy);
    else load();
  });

  function addValue(key: ListKey): void {
    if (!draft) return;
    const value = toKey(additions[key]);
    if (!value) return;
    if (draft[key].includes(value)) {
      errorMsg = `${value} is already in ${key}.`;
      return;
    }
    draft[key] = [...draft[key], value];
    additions[key] = '';
    errorMsg = '';
    draft = draft;
  }

  function removeValue(key: ListKey, value: string): void {
    if (!draft) return;
    draft[key] = draft[key].filter((v) => v !== value);
    draft = draft;
  }

  function resetToSeed(): void {
    if ($moveTaxonomySeed) draft = structuredClone($moveTaxonomySeed);
  }

  /**
   * Removing a value that historical rows still use is allowed, but it changes
   * what the reports group by, so it is worth confirming rather than silently
   * accepting.
   */
  $: removed = draft && $moveTaxonomy
    ? (['modalities', 'packingTiers', 'cargoTypes'] as ListKey[])
        .flatMap((k) => $moveTaxonomy![k].filter((v) => !draft![k].includes(v)))
    : [];

  $: dirty = !!draft && !!$moveTaxonomy &&
    JSON.stringify({ ...draft, updatedAt: 0, updatedBy: 0 }) !==
      JSON.stringify({ ...$moveTaxonomy, updatedAt: 0, updatedBy: 0 });

  async function save(): Promise<void> {
    if (!draft) return;
    saving = true;
    errorMsg = '';
    savedMsg = '';

    // Snapshot what is being sent. The operator can keep typing during the
    // round trip, and adopting the server's echo unconditionally would erase
    // whatever they added in the meantime.
    const sent = JSON.stringify(draft);

    try {
      const saved = await saveMoveTaxonomy(draft);
      conflict = false;

      if (JSON.stringify(draft) === sent) {
        // Untouched during the save: adopt the server's version, which carries
        // the authoritative updatedAt the next save needs.
        draft = structuredClone(saved);
        savedMsg = 'Saved. New analysis runs will use this vocabulary.';
      } else {
        // Edited mid-flight. Keep those edits, but take the new updatedAt so
        // the next save is checked against what was just written, not against
        // the version this edit started from.
        draft = { ...draft, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy };
        savedMsg = 'Saved. You have newer edits still unsaved.';
      }
    } catch (err: any) {
      if (err instanceof TaxonomyConflict) {
        conflict = true;
        errorMsg = `${err.message} Your edits are still here. Save again to overwrite theirs, or reload to take theirs.`;
      } else {
        errorMsg = err?.message ?? 'Could not save the taxonomy.';
      }
    } finally {
      saving = false;
    }
  }
</script>

<div class="tx">
  <header class="tx__head">
    <div>
      <h4>Move taxonomy</h4>
      <p>
        The vocabulary the price matrix groups by. The Qwilr analysis pipeline reads this same
        document, so a category added here is one the categorizer may assign on its next run.
      </p>
    </div>
    <div class="tx__actions">
      <button class="tx__ghost" on:click={() => load()} disabled={loading || saving}>
        {loading ? 'Loading…' : 'Reload'}
      </button>
      <button class="tx__ghost" on:click={resetToSeed} disabled={!$moveTaxonomySeed || saving}>
        Reset to defaults
      </button>
      <button class="tx__save" on:click={save} disabled={(!dirty && !conflict) || saving}>
        {saving ? 'Saving…' : conflict ? 'Save anyway' : 'Save'}
      </button>
    </div>
  </header>

  {#if errorMsg}<p class="tx__error">{errorMsg}</p>{/if}
  {#if savedMsg}<p class="tx__ok">{savedMsg}</p>{/if}

  {#if !draft}
    <p class="tx__empty">{loading ? 'Reading the configuration…' : 'No configuration loaded.'}</p>
  {:else}
    <div class="tx__grid">
      {#each LISTS as list}
        <section class="tx__card">
          <h5>{list.title}<span class="tx__count">{draft[list.key].length}</span></h5>
          <p class="tx__hint">{list.hint}</p>

          <ul class="tx__keys">
            {#each draft[list.key] as value (value)}
              <li>
                <code>{value}</code>
                <button
                  class="tx__x"
                  title="Remove {value}"
                  on:click={() => removeValue(list.key, value)}
                >✕</button>
              </li>
            {/each}
          </ul>

          <div class="tx__add">
            <input
              type="text"
              placeholder="add a value"
              bind:value={additions[list.key]}
              on:keydown={(e) => e.key === 'Enter' && addValue(list.key)}
            />
            <button on:click={() => addValue(list.key)} disabled={!toKey(additions[list.key])}>
              Add
            </button>
          </div>
          {#if additions[list.key] && toKey(additions[list.key]) !== additions[list.key].trim()}
            <p class="tx__hint">Will be stored as <code>{toKey(additions[list.key])}</code></p>
          {/if}
        </section>
      {/each}

      <section class="tx__card">
        <h5>Whole-move floor</h5>
        <p class="tx__hint">
          The lowest price that counts as a whole move. Anything cheaper is a deposit or a single
          service, and averaging those against whole moves understates what a move costs.
        </p>
        <div class="tx__add">
          <input type="number" min="0" step="50" bind:value={draft.minMovePrice} />
          <span class="tx__unit">per quote</span>
        </div>
        {#if draft.updatedBy}
          <p class="tx__hint">
            Last edited by {draft.updatedBy}
            {#if draft.updatedAt}
              on {new Date(draft.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            {/if}
          </p>
        {/if}
      </section>
    </div>

    {#if removed.length > 0}
      <p class="tx__warn">
        Removing {removed.map((r) => `"${r}"`).join(', ')} does not change any stored quote. Rows
        that already carry those values keep them and simply stop being grouped under a listed
        category.
      </p>
    {/if}
  {/if}
</div>

<style>
  /* Same palette as FinanceView and FinanceLedgerPanel: white cards on #e2e8f0
     borders, teal accent, Jost via --font-paragraph. */
  .tx {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  .tx__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .tx__head h4 {
    margin: 0;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .tx__head p {
    margin: 0.4rem 0 0;
    max-width: 62ch;
    font-size: 0.78rem;
    color: #64748b;
    line-height: 1.55;
  }

  .tx__actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .tx__ghost {
    padding: 0.46rem 0.95rem;
    border-radius: 9px;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #475569;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.14s cubic-bezier(0.4, 0, 0.2, 1), color 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tx__ghost:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }
  .tx__ghost:disabled { opacity: 0.5; cursor: default; }

  .tx__save {
    padding: 0.48rem 1.2rem;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    color: #fff;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(2, 181, 187, 0.3);
    transition: filter 0.14s cubic-bezier(0.4, 0, 0.2, 1), transform 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tx__save:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .tx__save:disabled { opacity: 0.5; cursor: default; box-shadow: none; }

  .tx__error,
  .tx__ok,
  .tx__warn {
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    margin: 0 0 0.9rem;
    line-height: 1.5;
  }

  .tx__error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
  .tx__ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }

  .tx__warn {
    background: #fffbeb;
    border: 1px solid #fde68a;
    color: #b45309;
    font-weight: 500;
    margin-top: 1rem;
  }

  .tx__empty {
    color: #94a3b8;
    font-size: 0.85rem;
    font-style: italic;
  }

  .tx__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .tx__card {
    padding: 1.25rem;
    border-radius: 16px;
    background: #fff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
  }

  .tx__card h5 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.35rem;
    font-size: 0.75rem;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .tx__count {
    background: linear-gradient(135deg, #02b5bb, #02999e);
    color: #fff;
    border-radius: 999px;
    font-size: 0.66rem;
    font-weight: 800;
    padding: 0.1em 0.55em;
  }

  .tx__hint {
    margin: 0 0 0.8rem;
    font-size: 0.72rem;
    color: #94a3b8;
    font-style: italic;
    line-height: 1.55;
  }

  .tx__keys {
    list-style: none;
    margin: 0 0 0.8rem;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .tx__keys li {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.22rem 0.3rem 0.22rem 0.55rem;
    border-radius: 999px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }

  .tx__keys code {
    font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.72rem;
    color: #334155;
  }

  .tx__x {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 0.62rem;
    cursor: pointer;
    line-height: 1;
  }

  .tx__x:hover { background: rgba(239, 68, 68, 0.12); color: #ef4444; }

  .tx__add {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .tx__add input {
    flex: 1;
    min-width: 0;
    padding: 0.42rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-family: inherit;
    font-size: 0.8rem;
    transition: border-color 0.14s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tx__add input:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }

  .tx__add button {
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #f1f5f9;
    color: #475569;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }

  .tx__add button:hover:not(:disabled) { background: #e2e8f0; color: #1e293b; }
  .tx__add button:disabled { opacity: 0.5; cursor: default; }

  .tx__unit { font-size: 0.72rem; color: #94a3b8; white-space: nowrap; }
</style>
