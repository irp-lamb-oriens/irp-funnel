<script lang="ts">
  import type { AttributionMetric, AttributionTouch } from '../../store.ts';
  import { formatMoney } from '$lib/money.ts';
  import {
    DIMENSIONS,
    UNTAGGED,
    aggregateFunnel,
    leadKey,
    pct,
    buildTaggedUrl,
    slugUtm,
    type AttributionDimension,
    type AttributionModel,
  } from './attributionAggregate.ts';

  export let attribution: AttributionMetric | null | undefined = undefined;

  type PeriodKey = '30d' | '90d' | 'year' | 'allTime' | 'custom';
  const PERIODS: Array<{ key: PeriodKey; label: string }> = [
    { key: '30d', label: '30 days' },
    { key: '90d', label: '90 days' },
    { key: 'year', label: 'This year' },
    { key: 'allTime', label: 'All time' },
    { key: 'custom', label: 'Custom range' },
  ];
  const MODELS: Array<{ key: AttributionModel; label: string; hint: string }> = [
    { key: 'first', label: 'First touch', hint: 'Credit goes to the ad that first brought the lead in' },
    { key: 'last', label: 'Last touch', hint: 'Credit goes to the last tagged link before they converted' },
  ];

  let period: PeriodKey = '90d';
  let model: AttributionModel = 'first';
  let dimension: AttributionDimension = 'source';
  let customStart = '';
  let customEnd = '';
  let expanded = '';
  let visibleRows = 15;

  $: leads = attribution?.leads ?? [];
  $: visits = attribution?.visits ?? [];

  $: range = (() => {
    const now = Date.now();
    const day = 86_400_000;
    if (period === '30d') return { start: now - 30 * day, end: Infinity };
    if (period === '90d') return { start: now - 90 * day, end: Infinity };
    if (period === 'year') return { start: Date.UTC(new Date().getUTCFullYear(), 0, 1), end: Infinity };
    if (period === 'custom') {
      return {
        start: customStart ? Date.parse(customStart) : -Infinity,
        end: customEnd ? Date.parse(customEnd) + day - 1 : Infinity,
      };
    }
    return { start: -Infinity, end: Infinity };
  })();

  $: result = aggregateFunnel(leads, visits, model, dimension, range.start, range.end);
  $: rows = result.rows;
  $: totals = result.totals;
  $: maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));
  $: maxLeads = Math.max(1, ...rows.map((r) => r.leads));
  $: hasRevenue = totals.revenue > 0;
  $: shownRows = rows.slice(0, visibleRows);
  $: currency = leads.find((l) => l.revenue > 0)?.currency ?? 'USD';
  $: leadsById = new Map(leads.map((l) => [l.id, l]));
  $: dimensionLabel = DIMENSIONS.find((d) => d.key === dimension)?.label ?? '';

  function money(n: number, cur: string = currency): string {
    return formatMoney(n, cur).replace(/\.00$/, '');
  }

  function toggle(key: string) {
    expanded = expanded === key ? '' : key;
  }

  function shortDate(iso: string): string {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—';
  }

  // ── Tagged-link builder ─────────────────────────────────────────────────
  // Suggestions come from values already in the data so naming stays
  // consistent ("instagram", never "Instagram" + "IG").
  let showBuilder = false;
  let b = {
    base: 'https://www.internationalrelocationpartner.com/',
    source: '',
    medium: '',
    campaign: '',
    content: '',
    term: '',
  };
  let copied = false;

  function seen(pick: (t: AttributionTouch) => string): string[] {
    const out = new Set<string>();
    for (const l of leads) for (const t of [l.first, l.last]) if (t && pick(t)) out.add(pick(t));
    for (const v of visits) if (pick(v.touch)) out.add(pick(v.touch));
    return [...out].sort();
  }
  $: seenSources = seen((t) => t.s);
  $: seenMediums = [...new Set(['paid_social', 'organic_social', 'cpc', 'email', 'referral', 'video', ...seen((t) => t.m)])].sort();
  $: seenCampaigns = seen((t) => t.c);
  $: builtUrl = b.source && b.medium && b.campaign ? buildTaggedUrl(b.base, b) : '';

  async function copyUrl() {
    if (!builtUrl) return;
    try {
      await navigator.clipboard.writeText(builtUrl);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      /* clipboard blocked — the URL is still selectable */
    }
  }
</script>

<div class="metric-module attribution-module">
  <div class="metrics-section">
    <h2>🎯 Attribution</h2>
    <p class="metrics-subtle">
      Which tagged link (UTM or <code>?refer=</code>) each lead came from, followed all the way to money.
      Touches are remembered across visits in the same browser and stitched across devices once the
      lead uses the same email.
    </p>

    {#if !attribution}
      <p class="attribution-empty">Attribution data isn't available yet — the server needs the latest deploy.</p>
    {:else}
      <div class="segment-bar">
        <div class="period-tabs">
          {#each PERIODS as p}
            <button class:active={period === p.key} on:click={() => (period = p.key)}>{p.label}</button>
          {/each}
        </div>

        {#if period === 'custom'}
          <label for="attr-start">From</label>
          <input id="attr-start" type="date" bind:value={customStart} />
          <label for="attr-end">To</label>
          <input id="attr-end" type="date" bind:value={customEnd} />
        {/if}
      </div>

      <div class="segment-bar">
        <div class="period-tabs" role="tablist" aria-label="Attribution model">
          {#each MODELS as m}
            <button class:active={model === m.key} title={m.hint} on:click={() => (model = m.key)}>{m.label}</button>
          {/each}
        </div>

        <label for="attr-dim">Group by</label>
        <select id="attr-dim" bind:value={dimension} on:change={() => { expanded = ''; visibleRows = 15; }}>
          {#each DIMENSIONS as d}
            <option value={d.key}>{d.label}</option>
          {/each}
        </select>
      </div>

      <div class="metrics-grid metrics-grid--small">
        <div class="metric-card" style="border-left: 4px solid #02b5bb">
          <div class="metric-card__value">{totals.visits}</div>
          <div class="metric-card__label">Tagged visits</div>
        </div>
        <div class="metric-card" style="border-left: 4px solid #3b82f6">
          <div class="metric-card__value">{totals.leads}</div>
          <div class="metric-card__label">Leads</div>
          <div class="metric-card__sub">{pct(totals.tagged, totals.leads)} tagged</div>
        </div>
        <div class="metric-card" style="border-left: 4px solid #868e96">
          <div class="metric-card__value">{totals.untagged}</div>
          <div class="metric-card__label">No tag</div>
          <div class="metric-card__sub">direct or lost in a device switch</div>
        </div>
        <div class="metric-card" style="border-left: 4px solid #f59e0b">
          <div class="metric-card__value">{totals.attended}</div>
          <div class="metric-card__label">Attended calls</div>
          <div class="metric-card__sub">{pct(totals.attended, totals.booked)} of {totals.booked} booked</div>
        </div>
        <div class="metric-card" style="border-left: 4px solid #10b981">
          <div class="metric-card__value">{totals.paid}</div>
          <div class="metric-card__label">Paid</div>
          <div class="metric-card__sub">{pct(totals.paid, totals.leads)} of leads</div>
        </div>
        <div class="metric-card" style="border-left: 4px solid #16a34a">
          <div class="metric-card__value attribution-money">{money(totals.revenue)}</div>
          <div class="metric-card__label">Revenue</div>
          <div class="metric-card__sub">accepted quotes</div>
        </div>
      </div>

      {#if totals.multiTouch || totals.multiDevice}
        <div class="metric-total attribution-journey">
          <strong>{totals.multiTouch}</strong> leads touched 2+ tagged links
          {#if totals.multiDevice}· <strong>{totals.multiDevice}</strong> used 2+ devices{/if}
          — switch between first and last touch to see where credit moves.
        </div>
      {/if}

      <div class="segment-controls attribution-subhead">
        <h2 style="margin: 0;">{hasRevenue ? 'Revenue' : 'Leads'} by {dimensionLabel.toLowerCase()}</h2>
      </div>
      <div class="bucket-list attribution-buckets">
        {#if rows.length === 0}
          <p class="attribution-empty">No leads in this period.</p>
        {:else}
          {#each rows.slice(0, 8) as r (r.key)}
            <div class="bucket-row" class:bucket-row--muted={r.key === UNTAGGED}>
              <span class="bucket-row__label" title={r.key}>{r.key}</span>
              <div class="bucket-row__track">
                <div
                  class="bucket-row__fill"
                  style="width: {((hasRevenue ? r.revenue / maxRevenue : r.leads / maxLeads) * 100).toFixed(1)}%"
                ></div>
              </div>
              <span class="bucket-row__value">{hasRevenue ? money(r.revenue) : r.leads}</span>
            </div>
          {/each}
        {/if}
      </div>

      {#if rows.length > 0}
        <div class="segment-controls">
          <h2 style="margin: 0;">Funnel by {dimensionLabel.toLowerCase()}</h2>
        </div>
        <div class="client-metric-table attribution-table">
          <div class="breakdown-header">
            <span>{dimensionLabel}</span>
            <span>Visits</span>
            <span>Leads</span>
            <span>Booked</span>
            <span>Attended</span>
            <span>Paid</span>
            <span>Revenue</span>
            <span>Lead → paid</span>
          </div>
          {#each shownRows as r (r.key)}
            <button
              type="button"
              class="breakdown-row attribution-row"
              class:attribution-row--untagged={r.key === UNTAGGED}
              class:attribution-row--open={expanded === r.key}
              aria-expanded={expanded === r.key}
              on:click={() => toggle(r.key)}
            >
              <span class="breakdown-row__model" title={r.key}>
                <span class="attribution-caret">{expanded === r.key ? '▾' : '▸'}</span>{r.key}
              </span>
              <span>{dimension === 'self' ? '—' : r.visits}</span>
              <span>{r.leads}</span>
              <span>{r.booked}</span>
              <span>{r.attended}{#if r.noShow}<em class="attribution-noshow">&nbsp;· {r.noShow} no-show</em>{/if}</span>
              <span>{r.paid}</span>
              <span class="breakdown-row__cost">{r.revenue ? money(r.revenue) : '—'}</span>
              <span>{pct(r.paid, r.leads)}</span>
            </button>

            {#if expanded === r.key}
              <div class="attribution-leads">
                {#each r.leadIds.slice(0, 40) as id (id)}
                  {@const l = leadsById.get(id)}
                  {#if l}
                    <div class="attribution-lead">
                      <span class="attribution-lead__name" title={l.name}>{l.name}</span>
                      <span class="attribution-lead__date">{shortDate(l.at)}</span>
                      <span class="attribution-lead__path" title="first touch → last touch">
                        {leadKey(l, 'first', dimension)}{#if leadKey(l, 'last', dimension) !== leadKey(l, 'first', dimension)} → {leadKey(l, 'last', dimension)}{/if}
                      </span>
                      <span class="attribution-lead__steps">
                        <i class:on={l.booked} title="Booked">Booked</i>
                        <i class:on={l.attended} class:off={l.noShow} title="Attended">{l.noShow ? 'No-show' : 'Attended'}</i>
                        <i class:on={l.paid} title="Paid">Paid</i>
                      </span>
                      <span class="attribution-lead__money">{l.revenue ? money(l.revenue, l.currency) : ''}</span>
                    </div>
                  {/if}
                {/each}
                {#if r.leadIds.length > 40}
                  <div class="attribution-lead attribution-lead--more">+ {r.leadIds.length - 40} more</div>
                {/if}
                {#if r.leadIds.length === 0}
                  <div class="attribution-lead attribution-lead--more">Visits only — no lead from this link yet.</div>
                {/if}
              </div>
            {/if}
          {/each}
          {#if rows.length > visibleRows}
            <div style="padding: 8px 16px;">
              <button class="show-more" on:click={() => (visibleRows += 25)}>
                Show {Math.min(25, rows.length - visibleRows)} more of {rows.length - visibleRows} remaining
              </button>
            </div>
          {/if}
        </div>
      {/if}

      {#if attribution.trackingSince}
        <div class="metric-total">
          UTM tracking since <strong>{shortDate(attribution.trackingSince)}</strong>
          <span class="attribution-footnote">— older leads only carry their self-reported source or legacy refer tag.</span>
        </div>
      {/if}
    {/if}

    <!-- ── Tagged-link builder ───────────────────────────────────────── -->
    <div class="attribution-builder" class:attribution-builder--open={showBuilder}>
      <button type="button" class="show-more attribution-builder__toggle" on:click={() => (showBuilder = !showBuilder)}>
        {showBuilder ? '▾' : '▸'} Build a tagged link
      </button>

      {#if showBuilder}
        <div class="segment-bar attribution-builder__fields">
          <label for="utm-base">Page</label>
          <input id="utm-base" class="attribution-builder__base" type="url" bind:value={b.base} />

          <label for="utm-source">Source*</label>
          <input id="utm-source" list="utm-sources" placeholder="instagram" bind:value={b.source} />
          <label for="utm-medium">Medium*</label>
          <input id="utm-medium" list="utm-mediums" placeholder="paid_social" bind:value={b.medium} />
          <label for="utm-campaign">Campaign*</label>
          <input id="utm-campaign" list="utm-campaigns" placeholder="retargeting_oct" bind:value={b.campaign} />
          <label for="utm-content">Content</label>
          <input id="utm-content" placeholder="video_a" bind:value={b.content} />
          <label for="utm-term">Term</label>
          <input id="utm-term" placeholder="optional" bind:value={b.term} />

          <datalist id="utm-sources">{#each seenSources as v}<option value={v}></option>{/each}</datalist>
          <datalist id="utm-mediums">{#each seenMediums as v}<option value={v}></option>{/each}</datalist>
          <datalist id="utm-campaigns">{#each seenCampaigns as v}<option value={v}></option>{/each}</datalist>
        </div>

        <div class="attribution-builder__out">
          {#if builtUrl}
            <code title={builtUrl}>{builtUrl}</code>
            <button type="button" class="attribution-builder__copy" on:click={copyUrl}>{copied ? 'Copied' : 'Copy'}</button>
          {:else}
            <span class="attribution-footnote">Fill source, medium and campaign. Values are saved as
              <code>{slugUtm('Like This') || 'like_this'}</code> so reports group cleanly.</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
