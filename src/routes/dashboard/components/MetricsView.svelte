<script lang="ts">
  import { metrics, clients, STAGE_LABELS, STAGE_ICONS, STAGE_COLORS, fetchCollectionData, activeView, salesReportPrefill } from '../store.ts';
  import { onMount } from 'svelte';
  import CallsMetricsModule from './metrics/CallsMetricsModule.svelte';
  import QuotesMetricsModule from './metrics/QuotesMetricsModule.svelte';
  import AttributionMetricsModule from './metrics/AttributionMetricsModule.svelte';

  // ── Sales Report deep links ────────────────────────────────────────────
  // Monthly Leads / Paid clients / Client acceptances share their definitions
  // with the Sales Report (server: API/finance/salesDefinitions.ts), so a
  // month clicked here opens the same month there with matching numbers.
  function openSalesReport(month?: string) {
    if (month) salesReportPrefill.set({ from: month, to: month });
    activeView.set('salesReport');
  }
  function monthLabel(key: string): string {
    const [y, m] = key.split('-').map(Number);
    if (!y || !m) return key;
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  // --- Dynamic Business Intelligence Engine ---
  // Now supports ANY collection, not just clients
  const AVAILABLE_COLLECTIONS = [
    { value: 'clients', label: '👥 Clients (Consultations)' },
    { value: 'irp_chatbot_threads', label: '💬 Chatbot Threads' },
    { value: 'emailQueue', label: '📧 Email Queue' },
    { value: 'llm_costs', label: '🤖 LLM Costs' },
    { value: 'llm_cost_snapshots', label: '📊 Weekly Cost Snapshots' },
  ];

  let selectedCollection = 'clients';
  let selectedGroupBy = 'stage';
  let activeFilters: Record<string, string> = {};

  // The active dataset for the BI engine (could be clients OR any other collection)
  let biDataset: any[] = [];
  let biLoading = false;
  let biError = '';

  // Caching schema and unique values
  let allKeys: string[] = [];
  let keyValuesMap: Record<string, string[]> = {};
  let isComputing = false;

  // Helper to safely get nested values (e.g. customFields.budget, arrays, etc.)
  function getNestedValues(obj: any, path: string): any[] {
    const segments = path.split('.');
    let current: any[] = [obj];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let next: any[] = [];
      
      for (const item of current) {
        if (!item) continue;
        
        // Is it trying to access an array item? e.g. "messages[]"
        if (seg.endsWith('[]')) {
          const arrKey = seg.replace('[]', '');
          const val = arrKey ? item[arrKey] : item; // if empty, current item is the array
          
          if (Array.isArray(val)) {
            next.push(...val);
          }
        } else {
          if (item[seg] !== undefined) {
            next.push(item[seg]);
          }
        }
      }
      current = next;
    }
    
    return current;
  }

  // When collection changes, fetch the appropriate data
  async function loadCollection(collection: string) {
    biLoading = true;
    biError = '';
    activeFilters = {};
    selectedGroupBy = '';
    
    try {
      let rawData = [];
      if (collection === 'clients') {
        // Use the already-loaded clients store
        rawData = $clients;
      } else {
        // Fetch from the generic BI endpoint
        rawData = await fetchCollectionData(collection === 'irp_chatbot_threads' ? 'irp_chatbot_threads' : collection);
      }

      // Filter out internal system documents
      biDataset = rawData.filter(doc => {
        const id = doc.id || doc._docId || '';
        const email = doc.email || doc.dripEmail || '';
        return !id.includes('system') && !email.includes('system');
      });
    } catch (err: any) {
      biError = err.message || 'Failed to load collection';
      biDataset = [];
    } finally {
      biLoading = false;
    }
  }

  // React to collection changes
  $: {
    if (selectedCollection) {
      loadCollection(selectedCollection);
    }
  }

  // Also update when clients store changes (for the default 'clients' collection)
  $: if (selectedCollection === 'clients' && $clients) {
    biDataset = $clients.filter(doc => !doc.id.includes('system') && !(doc.email || '').includes('system'));
  }

  // Compute schema from the active dataset recursively
  $: if (biDataset && biDataset.length > 0) {
    isComputing = true;
    
    setTimeout(() => {
      const tempKeys = new Set<string>();
      const tempValues: Record<string, Set<string>> = {};

      // Recursive function to extract keys dynamically from maps, arrays, subcollections
      const extractKeys = (obj: any, prefix = '', depth = 0) => {
        if (!obj || typeof obj !== 'object' || depth > 5) return; // Max depth 5 to prevent infinite loops
        
        for (const k in obj) {
          if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
          
          const val = obj[k];
          const newKey = prefix ? `${prefix}.${k}` : k;

          if (Array.isArray(val)) {
            // For arrays: count items
            tempKeys.add(`${newKey}._count`);
            if (!tempValues[`${newKey}._count`]) tempValues[`${newKey}._count`] = new Set();
            tempValues[`${newKey}._count`].add(String(val.length));
            
            // Extract items and inner fields
            for (const item of val) {
              if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                tempKeys.add(`${newKey}[]`);
                if (!tempValues[`${newKey}[]`]) tempValues[`${newKey}[]`] = new Set();
                tempValues[`${newKey}[]`].add(String(item));
              } else if (item && typeof item === 'object') {
                // Recurse into array of objects (e.g. messages[].extractedFields.email)
                extractKeys(item, `${newKey}[]`, depth + 1);
              }
            }
            continue;
          }

          if (val && typeof val === 'object' && !(val instanceof Date)) {
            extractKeys(val, newKey, depth + 1);
          } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            tempKeys.add(newKey);
            if (!tempValues[newKey]) tempValues[newKey] = new Set();
            if (val !== undefined && val !== null && val !== '') {
              tempValues[newKey].add(String(val));
            }
          }
        }
      };

      for (let i = 0; i < biDataset.length; i++) {
        extractKeys(biDataset[i]);
      }

      allKeys = Array.from(tempKeys).sort();
      if (!selectedGroupBy && allKeys.length > 0) {
        selectedGroupBy = allKeys[0];
      }
      
      const finalizedMap: Record<string, string[]> = {};
      for (const k of allKeys) {
        finalizedMap[k] = Array.from(tempValues[k] || []).sort();
      }
      keyValuesMap = finalizedMap;
      isComputing = false;
    }, 0);
  }

  // Active filter processing + grouping in a single pass
  let filteredData: any[] = [];
  let sortedGroups: [string, number][] = [];
  let isFiltering = false;

  $: {
    if (biDataset && biDataset.length > 0 && selectedGroupBy) {
      const activeFiltersCopy = { ...activeFilters };
      const groupByCopy = selectedGroupBy;
      const datasetCopy = biDataset;
      
      isFiltering = true;
      
      setTimeout(() => {
        const matched = [];
        const filterEntries = Object.entries(activeFiltersCopy).filter(([_, v]) => v !== '');
        const filterLen = filterEntries.length;
        const groupCounts = new Map<string, number>();

        for (let i = 0; i < datasetCopy.length; i++) {
          const c = datasetCopy[i];
          let keep = true;

          for (let j = 0; j < filterLen; j++) {
            const key = filterEntries[j][0];
            const requiredVal = filterEntries[j][1];
            
            // Handle special array count keys
            let foundMatch = false;
            
            if (key.endsWith('._count')) {
              // Get the actual array by removing the _count and [] segments
              const arrPath = key.replace(/\._count$/, '').replace(/\[\]/g, ''); 
              const arrays = getNestedValues(c, arrPath);
              for (const arr of arrays) {
                 if (Array.isArray(arr) && String(arr.length) === requiredVal) {
                   foundMatch = true;
                   break;
                 }
              }
            } else {
              const cValues = getNestedValues(c, key);
              for (const v of cValues) {
                if (String(v) === requiredVal) {
                  foundMatch = true;
                  break;
                }
              }
            }
            
            if (!foundMatch) {
              keep = false;
              break;
            }
          }

          if (keep) {
            matched.push(c);

            // Group By processing
            let groupVals: any[] = [];
            
            if (groupByCopy.endsWith('._count')) {
              const arrPath = groupByCopy.replace(/\._count$/, '').replace(/\[\]/g, '');
              const arrays = getNestedValues(c, arrPath);
              for (const arr of arrays) {
                groupVals.push(Array.isArray(arr) ? arr.length : undefined);
              }
            } else {
              groupVals = getNestedValues(c, groupByCopy);
            }
            
            if (groupVals.length === 0) {
              groupCounts.set('Unknown / Not Set', (groupCounts.get('Unknown / Not Set') || 0) + 1);
            } else {
              // To avoid over-counting if an array has the same extracted field multiple times (e.g. multiple "assistant" messages)
              // We count each unique group value only once per document
              const uniqueVals = new Set(groupVals.map(v => (v === undefined || v === null || v === '') ? 'Unknown / Not Set' : String(v)));
              uniqueVals.forEach(valStr => {
                groupCounts.set(valStr, (groupCounts.get(valStr) || 0) + 1);
              });
            }
          }
        }
        
        filteredData = matched;
        
        const tempSorted: [string, number][] = [];
        groupCounts.forEach((count, key) => {
          tempSorted.push([key, count]);
        });
        tempSorted.sort((a, b) => b[1] - a[1]);
        
        sortedGroups = tempSorted;
        isFiltering = false;
      }, 0);
    }
  }

  function removeFilter(key: string) {
    const newFilters = { ...activeFilters };
    delete newFilters[key];
    activeFilters = newFilters;
  }

  function handleFilterChange(key: string, e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    if (val === '') {
      removeFilter(key);
    } else {
      activeFilters = { ...activeFilters, [key]: val };
    }
  }

  function clearFilters() {
    activeFilters = {};
  }
</script>

<style>
  .evo-highlight-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 24px;
  }

  .evo-highlight-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .evo-icon {
    font-size: 28px;
  }

  .evo-highlight-left h3 {
    margin: 0;
    color: #e2e8f0;
    font-size: 18px;
    font-weight: 700;
  }

  .evo-highlight-left p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 13px;
  }

  .evo-highlight-right {
    text-align: right;
  }

  .evo-highlight-right h2 {
    margin: 0;
    font-size: 32px;
    font-weight: 800;
    color: #34d399;
    letter-spacing: -0.02em;
  }

  .evo-subtitle {
    display: block;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 500;
    margin-top: 4px;
  }

  /* ── AI Cost Summary Pill ─────────────────────────────────────────────
     Moved from the dashboard topbar into the Metrics page.
     Floats at the top of the LLM section as a quick-glance banner.      */
  .llm-cost-summary {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
    padding: 0.6rem 1rem;
    background: rgba(2, 181, 187, 0.07);
    border: 1px solid rgba(2, 181, 187, 0.2);
    border-radius: 10px;
    margin-bottom: 1rem;
    font-size: 0.82rem;
    color: #0f172a;
  }
  .llm-cost-summary__icon { font-size: 1rem; }
  .llm-cost-summary__label {
    font-weight: 600;
    color: #475569;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .llm-cost-summary__item {
    font-size: 0.84rem;
    color: #334155;
  }
  .llm-cost-summary__item strong {
    color: #0f172a;
    font-weight: 700;
  }
  .llm-cost-summary__item--week strong  { color: #16a34a; }  /* green  */
  .llm-cost-summary__item--month strong { color: #2563eb; }  /* blue   */
  .llm-cost-summary__item--total strong { color: #02b5bb; }  /* teal   */
  .llm-cost-summary__sep {
    color: #cbd5e1;
    font-weight: 300;
    user-select: none;
  }

  /* ── Stage Satisfaction ────────────────────────────────────────────── */
  .metrics-subtle {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 16px;
    max-width: 680px;
  }
  .rating-star { color: #f59e0b; margin-left: 2px; }
  .stage-ratings {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  }
  .stage-rating-row {
    display: grid;
    grid-template-columns: minmax(140px, 220px) 1fr minmax(96px, 120px);
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .stage-rating-label {
    font-weight: 500;
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stage-rating-icon { margin-right: 6px; }
  .stage-rating-bar-wrap {
    background: #f1f5f9;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
  }
  .stage-rating-bar {
    height: 100%;
    border-radius: 5px;
    transition: width 0.3s ease;
    min-width: 2px;
  }
  .stage-rating-score {
    text-align: right;
    color: #1e293b;
    white-space: nowrap;
  }
  .stage-rating-count { color: #94a3b8; font-size: 12px; margin-left: 2px; }
  .stage-rating-empty { color: #cbd5e1; font-style: italic; font-size: 12px; }
  .metrics-section__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  .sales-link {
    background: none;
    border: none;
    padding: 0;
    margin-left: 12px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: #02868a;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .sales-link:hover { color: #02b5bb; }
  .monthly-bar--link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    border-radius: 6px;
  }
  .monthly-bar--link:hover { background: rgba(2, 181, 187, 0.06); }
  .monthly-bar--link:focus-visible, .sales-link:focus-visible { outline: 2px solid #02b5bb; outline-offset: 2px; }
</style>


<div class="metrics-view">
  {#if $metrics}
    
    <!-- Dynamic Business Intelligence Section -->
    <div class="metrics-section dynamic-bi-section" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <h2 style="margin-top: 0; color: #1e293b; font-size: 18px; margin-bottom: 16px;">🔍 Dynamic Business Intelligence</h2>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">
        Query any collection, filter by any field recursively (maps, arrays, subcollections), and group by any dimension.
      </p>

      <div class="bi-controls" style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div class="bi-group">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Collection</label>
          <select bind:value={selectedCollection} style="padding: 8px; border-radius: 6px; border: 1px solid #02b5bb; font-size: 13px; min-width: 200px; font-weight: 600; color: #0b3b3d; background: rgba(2,181,187,0.08);">
            {#each AVAILABLE_COLLECTIONS as col}
              <option value={col.value}>{col.label}</option>
            {/each}
          </select>
        </div>

        <div class="bi-group">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Group By</label>
          <select bind:value={selectedGroupBy} style="padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; min-width: 180px;">
            {#each allKeys as key}
              <option value={key}>{key}</option>
            {/each}
          </select>
        </div>

        <!-- Generative Filters UI -->
        <div class="bi-filters" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; width: 100%;">
          {#if Object.keys(activeFilters).length > 0}
            <div style="width: 100%; font-size: 13px; color: #334155; font-weight: 600;">Active Filters (Stacked):</div>
          {/if}

          {#each Object.keys(activeFilters) as filterKey}
            <div class="bi-group" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 2px rgba(0,0,0,0.02); position: relative;">
              <button on:click={() => removeFilter(filterKey)} style="position: absolute; top: 4px; right: 4px; border: none; background: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 4px;" title="Remove this filter">✕</button>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px; padding-right: 16px;">{filterKey}</label>
              <select on:change={(e) => handleFilterChange(filterKey, e)} style="padding: 8px; border-radius: 6px; border: 1px solid #3b82f6; font-size: 13px; color: #1d4ed8; font-weight: 500; min-width: 160px; outline: none; background-color: #eff6ff;">
                <option value="">-- Choose Value --</option>
                {#each (keyValuesMap[filterKey] || []) as val}
                  <option value={String(val)} selected={activeFilters[filterKey] === String(val)}>{val}</option>
                {/each}
              </select>
            </div>
          {/each}

          <div class="bi-group" style="margin-top: 10px;">
            <select on:change={(e) => { const k = (e.target as HTMLSelectElement).value; if(k) activeFilters = {...activeFilters, [k]: ''}; (e.target as HTMLSelectElement).value = ''; }} style="padding: 10px; border-radius: 6px; border: 1px dashed #94a3b8; font-size: 13px; background: white; cursor: pointer;">
              <option value="">+ Add another filter</option>
              {#each allKeys.filter(k => !(k in activeFilters)) as key}
                <option value={key}>{key}</option>
              {/each}
            </select>
          </div>

          {#if Object.keys(activeFilters).length > 0}
            <button on:click={clearFilters} style="padding: 10px 16px; margin-top: 10px; background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: 6px; font-size: 13px; cursor: pointer;">Clear All</button>
          {/if}
        </div>
      </div>

      <div class="bi-results" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
        <h3 style="margin-top: 0; font-size: 15px; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>Results: {filteredData.length} of {biDataset.length} documents · {allKeys.length} fields detected</span>
          {#if isComputing || isFiltering || biLoading}
             <span style="font-size: 12px; color: #3b82f6; font-weight: 500;">{biLoading ? 'Loading collection...' : 'Calculating...'} ⏳</span>
          {/if}
        </h3>
        {#if biError}
          <p style="font-size: 13px; color: #ef4444;">{biError}</p>
        {/if}
        
        {#if sortedGroups.length === 0 && !isFiltering}
          <p style="font-size: 13px; color: #94a3b8;">No data matches the current filters.</p>
        {:else if !isFiltering}
          <div class="bi-table" style="display: grid; gap: 8px;">
            {#each sortedGroups as [groupVal, count]}
              <div class="bi-row" style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
                <span class="bi-row-label" style="font-weight: 500; color: #334155; width: 30%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title={groupVal}>{groupVal}</span>
                <div class="bi-row-bar" style="flex-grow: 1; margin: 0 16px; background: #f1f5f9; height: 10px; border-radius: 5px; overflow: hidden;">
                  <div style="width: {Math.min(100, (count / filteredData.length) * 100)}%; height: 100%; background: #3b82f6; border-radius: 5px;"></div>
                </div>
                <span class="bi-row-count" style="font-weight: 600; color: #1e293b; width: 40px; text-align: right;">{count}</span>
                <span class="bi-row-percent" style="color: #64748b; width: 50px; text-align: right; font-size: 12px;">{((count / filteredData.length) * 100).toFixed(1)}%</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Pipeline Overview -->
    <div class="metrics-section">
      <h2>Pipeline Overview</h2>
      <div class="metrics-grid">
        {#each Object.entries($metrics.pipeline.stageCounts) as [stage, count]}
          <div class="metric-card" style="border-left: 4px solid {STAGE_COLORS[stage]}">
            <div class="metric-card__icon">{STAGE_ICONS[stage]}</div>
            <div class="metric-card__value">{count}</div>
            <div class="metric-card__label">{STAGE_LABELS[stage]}</div>
          </div>
        {/each}
      </div>
      <div class="metric-total">
        Total Clients: <strong>{$metrics.pipeline.total}</strong>
        <button class="sales-link" on:click={() => openSalesReport()}>See how leads flow through the funnel in the Sales Report →</button>
      </div>
    </div>

    <!-- Attribution: tagged link (UTM / refer) → lead → call → paid → revenue -->
    <AttributionMetricsModule attribution={$metrics.attribution} />

    <!-- Call + Quote activity (segmented per-client modules) -->
    {#if $metrics.activity}
      <CallsMetricsModule activity={$metrics.activity} />
      <QuotesMetricsModule activity={$metrics.activity} />
    {/if}

    <!-- Stage Satisfaction (client scoring per journey stage) -->
    {#if $metrics.stageRatings}
      <div class="metrics-section">
        <h2>Stage Satisfaction</h2>
        <p class="metrics-subtle">
          Average client scoring per journey stage, updated incrementally as clients rate each step
          on their status page (running sum ÷ count — no full recompute).
        </p>

        <div class="metrics-grid metrics-grid--small">
          <div class="metric-card" style="border-left: 4px solid #f59e0b">
            <div class="metric-card__value">
              {$metrics.stageRatings.globalAverage ? $metrics.stageRatings.globalAverage.toFixed(2) : '—'}
              <span class="rating-star">★</span>
            </div>
            <div class="metric-card__label">Overall Journey Avg</div>
          </div>
          <div class="metric-card" style="border-left: 4px solid #16a34a">
            <div class="metric-card__value">
              {$metrics.stageRatings.overall.average ? $metrics.stageRatings.overall.average.toFixed(2) : '—'}
              <span class="rating-star">★</span>
            </div>
            <div class="metric-card__label">Final Review ({$metrics.stageRatings.overall.count})</div>
          </div>
          <div class="metric-card">
            <div class="metric-card__value">{$metrics.stageRatings.totalRatings}</div>
            <div class="metric-card__label">Total Ratings</div>
          </div>
        </div>

        <div class="stage-ratings">
          {#each $metrics.stageRatings.perStage as row}
            <div class="stage-rating-row">
              <div class="stage-rating-label">
                <span class="stage-rating-icon">{STAGE_ICONS[row.stage] ?? '•'}</span>
                {row.label}
              </div>
              <div class="stage-rating-bar-wrap">
                <div
                  class="stage-rating-bar"
                  style="width: {row.count > 0 ? (row.average / 5) * 100 : 0}%; background: {STAGE_COLORS[row.stage] ?? '#02b5bb'}"
                ></div>
              </div>
              <div class="stage-rating-score">
                {#if row.count > 0}
                  <strong>{row.average.toFixed(2)}</strong><span class="rating-star">★</span>
                  <span class="stage-rating-count">({row.count})</span>
                {:else}
                  <span class="stage-rating-empty">not yet rated</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        {#if $metrics.stageRatings.updatedAt}
          <div class="metric-total">
            Last rating: <strong>{new Date($metrics.stageRatings.updatedAt).toLocaleString()}</strong>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Outcomes -->

    <div class="metrics-section">
      <h2>Call Outcomes</h2>
      <div class="metrics-grid metrics-grid--small">
        <div class="metric-card metric-card--outcome">
          <div class="metric-card__value">{$metrics.outcomes.qualified || 0}</div>
          <div class="metric-card__label">Qualified</div>
        </div>
        <div class="metric-card metric-card--outcome">
          <div class="metric-card__value">{$metrics.outcomes.nurture || 0}</div>
          <div class="metric-card__label">Nurture</div>
        </div>
        <div class="metric-card metric-card--outcome">
          <div class="metric-card__value">{$metrics.outcomes.no_show || 0}</div>
          <div class="metric-card__label">No Show</div>
        </div>
      </div>
    </div>

    <!-- Email Queue -->
    <div class="metrics-section">
      <h2>Email Queue</h2>
      <div class="metrics-grid metrics-grid--small">
        <div class="metric-card">
          <div class="metric-card__value" style="color: #f59e0b">{$metrics.emailQueue.pending}</div>
          <div class="metric-card__label">Pending</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__value" style="color: #10b981">{$metrics.emailQueue.sent}</div>
          <div class="metric-card__label">Sent</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__value" style="color: #ef4444">{$metrics.emailQueue.failed}</div>
          <div class="metric-card__label">Failed</div>
        </div>
      </div>
    </div>

    <!-- LLM Cost Summary Pill (moved from dashboard topbar) -->
    <div class="llm-cost-summary">
      <span class="llm-cost-summary__icon">🤖</span>
      <span class="llm-cost-summary__label">AI Cost at a glance:</span>
      <span class="llm-cost-summary__item llm-cost-summary__item--week">
        W <strong>${$metrics.llmCosts.periodSpend?.thisWeek?.toFixed(2) || '0.00'}</strong>
      </span>
      <span class="llm-cost-summary__sep">·</span>
      <span class="llm-cost-summary__item llm-cost-summary__item--month">
        M <strong>${$metrics.llmCosts.periodSpend?.thisMonth?.toFixed(2) || '0.00'}</strong>
      </span>
      <span class="llm-cost-summary__sep">·</span>
      <span class="llm-cost-summary__item llm-cost-summary__item--total">
        ∑ <strong>${$metrics.llmCosts.totalCost.toFixed(2)}</strong>
      </span>
    </div>

    <!-- LLM Costs — Period Spend Breakdown -->
    <div class="metrics-section">
      <h2>🤖 AI Spend — Period Breakdown</h2>
      <div class="metrics-grid metrics-grid--small">
        <div class="metric-card" style="border-left: 4px solid #22c55e">
          <div class="metric-card__value">${$metrics.llmCosts.periodSpend?.thisWeek?.toFixed(4) || '0.0000'}</div>
          <div class="metric-card__label">This Week</div>
        </div>
        <div class="metric-card" style="border-left: 4px solid #3b82f6">
          <div class="metric-card__value">${$metrics.llmCosts.periodSpend?.thisMonth?.toFixed(4) || '0.0000'}</div>
          <div class="metric-card__label">This Month</div>
        </div>
        <div class="metric-card" style="border-left: 4px solid #f59e0b">
          <div class="metric-card__value">${$metrics.llmCosts.periodSpend?.thisYear?.toFixed(4) || '0.0000'}</div>
          <div class="metric-card__label">This Year</div>
        </div>
        <div class="metric-card" style="border-left: 4px solid #02b5bb">
          <div class="metric-card__value">${$metrics.llmCosts.totalCost.toFixed(4)}</div>
          <div class="metric-card__label">All Time</div>
        </div>
      </div>
      <div class="metrics-grid metrics-grid--small" style="margin-top: 12px;">
        <div class="metric-card">
          <div class="metric-card__value">{$metrics.llmCosts.callCount}</div>
          <div class="metric-card__label">Total API Calls</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__value">{(($metrics.llmCosts.totalInputTokens + $metrics.llmCosts.totalOutputTokens) / 1000).toFixed(1)}K</div>
          <div class="metric-card__label">Total Tokens</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__value">{$metrics.llmCosts.uniqueSessions || 0}</div>
          <div class="metric-card__label">Chat Sessions</div>
        </div>
      </div>
    </div>

    <!-- LLM Costs — Weekly Spend History -->
    {#if $metrics.llmCosts.weeklySnapshots && $metrics.llmCosts.weeklySnapshots.length > 0}
      <div class="metrics-section">
        <h2>📅 Weekly AI Spend History</h2>
        <div class="monthly-chart">
          {#each $metrics.llmCosts.weeklySnapshots as snap}
            <div class="monthly-bar">
              <div class="monthly-bar__fill" style="height: {Math.min(100, (snap.totalCost / Math.max(...$metrics.llmCosts.weeklySnapshots.map(s => s.totalCost), 0.001)) * 100)}%; background: #02b5bb;"></div>
              <span class="monthly-bar__count">${snap.totalCost.toFixed(2)}</span>
              <span class="monthly-bar__label">{snap.weekKey}</span>
            </div>
          {/each}
        </div>
        <div class="breakdown-table" style="margin-top: 16px;">
          <div class="breakdown-header">
            <span>Week</span><span>Period</span><span>Calls</span><span>Tokens</span><span>Cost</span>
          </div>
          {#each [...$metrics.llmCosts.weeklySnapshots].reverse() as snap}
            <div class="breakdown-row">
              <span class="breakdown-row__model">{snap.weekKey}</span>
              <span>{snap.weekStart} → {snap.weekEnd}</span>
              <span>{snap.callCount}</span>
              <span>{((snap.inputTokens + snap.outputTokens) / 1000).toFixed(1)}K</span>
              <span class="breakdown-row__cost">${snap.totalCost.toFixed(4)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- LLM Costs — By Provider -->
    {#if $metrics.llmCosts.byProvider && Object.keys($metrics.llmCosts.byProvider).length > 0}
      <div class="metrics-section">
        <h2>Cost by Provider</h2>
        <div class="metrics-grid metrics-grid--small">
          {#each Object.entries($metrics.llmCosts.byProvider) as [provider, data]}
            <div class="metric-card" style="border-left: 4px solid {provider === 'openrouter' ? '#f97316' : provider === 'google' ? '#3b82f6' : '#02b5bb'}">
              <div class="metric-card__value">${data.cost.toFixed(4)}</div>
              <div class="metric-card__label">{provider}</div>
              <div class="metric-card__sub">{data.calls} calls · {((data.inputTokens + data.outputTokens) / 1000).toFixed(1)}K tok</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- LLM Costs — By Model -->
    {#if $metrics.llmCosts.byModel && Object.keys($metrics.llmCosts.byModel).length > 0}
      <div class="metrics-section">
        <h2>Cost by Model</h2>
        <div class="breakdown-table">
          <div class="breakdown-header">
            <span>Model</span><span>Calls</span><span>Input</span><span>Output</span><span>Cost</span>
          </div>
          {#each Object.entries($metrics.llmCosts.byModel).sort((a, b) => b[1].cost - a[1].cost) as [model, data]}
            <div class="breakdown-row">
              <span class="breakdown-row__model">{model.split('/').pop()}</span>
              <span>{data.calls}</span>
              <span>{(data.inputTokens / 1000).toFixed(1)}K</span>
              <span>{(data.outputTokens / 1000).toFixed(1)}K</span>
              <span class="breakdown-row__cost">${data.cost.toFixed(4)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Channel Breakdown -->
    {#if $metrics.channelBreakdown}
      <div class="metrics-section">
        <h2>📊 Lead Channels</h2>
        <div class="metrics-grid metrics-grid--small">
          <div class="metric-card" style="border-left: 4px solid #02b5bb">
            <div class="metric-card__icon">💬</div>
            <div class="metric-card__value">{$metrics.channelBreakdown.chatbot || 0}</div>
            <div class="metric-card__label">AI Chatbot</div>
          </div>
          <div class="metric-card" style="border-left: 4px solid #fbbf24">
            <div class="metric-card__icon">📋</div>
            <div class="metric-card__value">{$metrics.channelBreakdown.form || 0}</div>
            <div class="metric-card__label">Form</div>
          </div>
          <div class="metric-card" style="border-left: 4px solid #25d366">
            <div class="metric-card__icon">📱</div>
            <div class="metric-card__value">{$metrics.channelBreakdown.whatsapp || 0}</div>
            <div class="metric-card__label">WhatsApp</div>
          </div>
          <div class="metric-card">
            <div class="metric-card__value">{$metrics.channelBreakdown.unknown || 0}</div>
            <div class="metric-card__label">Other</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Country Breakdown -->
    {#if $metrics.countryBreakdown && Object.keys($metrics.countryBreakdown).length > 0}
      <div class="metrics-section">
        <h2>🌍 Top Destination Countries</h2>
        <div class="breakdown-table">
          <div class="breakdown-header">
            <span>Country</span><span>Leads</span><span>Share</span>
          </div>
          {#each Object.entries($metrics.countryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 15) as [country, count]}
            <div class="breakdown-row">
              <span class="breakdown-row__model">{country}</span>
              <span>{count}</span>
              <span class="breakdown-row__cost">{(count / $metrics.pipeline.total * 100).toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Monthly Leads -->
    {#if Object.keys($metrics.monthlyLeads).length > 0}
      <div class="metrics-section">
        <div class="metrics-section__head">
          <h2>Monthly Leads</h2>
          <button class="sales-link" on:click={() => openSalesReport()}>Open Sales Report →</button>
        </div>
        {#if $metrics.salesDefinitionsVersion === 2}<p class="metrics-subtle">Same definition as the Sales Report · months in Costa Rica time · click a month to open it there.</p>{/if}
        <div class="monthly-chart">
          {#each Object.entries($metrics.monthlyLeads).sort() as [month, count]}
            <button class="monthly-bar monthly-bar--link" title="{monthLabel(month)}: {count} — open in Sales Report" on:click={() => openSalesReport(month)}>
              <div class="monthly-bar__fill" style="height: {Math.min(100, (count / Math.max(...Object.values($metrics.monthlyLeads))) * 100)}%;"></div>
              <span class="monthly-bar__count">{count}</span>
              <span class="monthly-bar__label">{month}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Monthly Paid Users -->
    {#if $metrics.monthlyPaidUsers && Object.keys($metrics.monthlyPaidUsers).length > 0}
      <div class="metrics-section">
        <div class="metrics-section__head">
          <h2>💳 Monthly Paid Users</h2>
          <button class="sales-link" on:click={() => openSalesReport()}>Open Sales Report →</button>
        </div>
        <div class="metric-total" style="margin-bottom: 12px;">
          Total paid clients: <strong>{Object.values($metrics.monthlyPaidUsers).reduce((a, b) => a + b, 0)}</strong>
        </div>
        {#if $metrics.salesDefinitionsVersion === 2}<p class="metrics-subtle">A client counts in the month of their first recorded payment (invoice or Finance). Dropped deals are not counted as paid.</p>{/if}
        <div class="monthly-chart">
          {#each Object.entries($metrics.monthlyPaidUsers).sort() as [month, count]}
            <button class="monthly-bar monthly-bar--link" title="{monthLabel(month)}: {count} — open in Sales Report" on:click={() => openSalesReport(month)}>
              <div class="monthly-bar__fill" style="height: {Math.min(100, (count / Math.max(...Object.values($metrics.monthlyPaidUsers))) * 100)}%; background: linear-gradient(180deg, #10b981, #059669);"></div>
              <span class="monthly-bar__count">{count}</span>
              <span class="monthly-bar__label">{month}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Monthly Client Acceptances (shared sales definitions) -->
    {#if $metrics.monthlyClientAcceptances && Object.keys($metrics.monthlyClientAcceptances).length > 0}
      <div class="metrics-section">
        <div class="metrics-section__head">
          <h2>🤝 Monthly Client Acceptances</h2>
          <button class="sales-link" on:click={() => openSalesReport()}>Open Sales Report →</button>
        </div>
        <p class="metrics-subtle">Clients whose first quote acceptance happened that month — the "Won deals" figure in the Sales Report.</p>
        <div class="monthly-chart">
          {#each Object.entries($metrics.monthlyClientAcceptances).sort() as [month, count]}
            <button class="monthly-bar monthly-bar--link" title="{monthLabel(month)}: {count} — open in Sales Report" on:click={() => openSalesReport(month)}>
              <div class="monthly-bar__fill" style="height: {Math.min(100, (count / Math.max(...Object.values($metrics.monthlyClientAcceptances))) * 100)}%; background: linear-gradient(180deg, #8b5cf6, #6d28d9);"></div>
              <span class="monthly-bar__count">{count}</span>
              <span class="monthly-bar__label">{month}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Monthly Quote Approvals -->
    {#if $metrics.monthlyApprovals && Object.keys($metrics.monthlyApprovals).length > 0}
      <div class="metrics-section">
        <h2>✅ Internal Quote Approval Decisions</h2>
        <p class="metrics-subtle">
          Team sign-offs on quotes before they go to the client, per month, keyed by the date each approver decided.
          This is not client acceptance — see Monthly Client Acceptances above.
        </p>
        <div class="metrics-grid metrics-grid--small">
          <div class="metric-card" style="border-left: 4px solid #f59e0b">
            <div class="metric-card__value">{Object.values($metrics.monthlyApprovals).reduce((a, b) => a + b, 0)}</div>
            <div class="metric-card__label">Total Approval Decisions</div>
          </div>
          <div class="metric-card" style="border-left: 4px solid #16a34a">
            <div class="metric-card__value">{Object.values($metrics.monthlyApprovedQuotes || {}).reduce((a, b) => a + b, 0)}</div>
            <div class="metric-card__label">Quotes Approved</div>
          </div>
        </div>
        <div class="monthly-chart">
          {#each Object.entries($metrics.monthlyApprovals).sort() as [month, count]}
            <div class="monthly-bar">
              <div class="monthly-bar__fill" style="height: {Math.min(100, (count / Math.max(...Object.values($metrics.monthlyApprovals))) * 100)}%; background: linear-gradient(180deg, #f59e0b, #d97706);"></div>
              <span class="monthly-bar__count">{count}</span>
              <span class="monthly-bar__label">{month}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <div class="dashboard__loading">
      <div class="spinner"></div>
      <p>Loading metrics…</p>
    </div>
  {/if}
</div>