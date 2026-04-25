<script lang="ts">
  import { metrics, clients, STAGE_LABELS, STAGE_ICONS, STAGE_COLORS, fetchCollectionData } from '../store.ts';
  import { fetchLeaderboard, evoLeaderboard } from './evo/evoStore.ts';
  import EvoLeaderboard from './evo/EvoLeaderboard.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    fetchLeaderboard();
  });

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
</style>

<div class="metrics-view">
  {#if $metrics}
    
    {#if $evoLeaderboard && $evoLeaderboard.totals && $evoLeaderboard.rows.length > 0}
      <div class="evo-highlight-banner">
        <div class="evo-highlight-left">
          <span class="evo-icon">✨</span>
          <div>
            <h3>Evo Pipeline Generated</h3>
            <p>Total pipeline value driven by tracked UI components.</p>
          </div>
        </div>
        <div class="evo-highlight-right">
          <h2>${($evoLeaderboard.totals.revenueUsd ?? 0).toLocaleString()}</h2>
          <span class="evo-subtitle">{$evoLeaderboard.totals.paidVisitors} Consultations</span>
        </div>
      </div>

      <div class="metrics-section" style="margin-bottom: 24px;">
        <EvoLeaderboard />
      </div>
    {/if}

    <!-- Dynamic Business Intelligence Section -->
    <div class="metrics-section dynamic-bi-section" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <h2 style="margin-top: 0; color: #1e293b; font-size: 18px; margin-bottom: 16px;">🔍 Dynamic Business Intelligence</h2>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">
        Query any collection, filter by any field recursively (maps, arrays, subcollections), and group by any dimension.
      </p>

      <div class="bi-controls" style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div class="bi-group">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Collection</label>
          <select bind:value={selectedCollection} style="padding: 8px; border-radius: 6px; border: 1px solid #6366f1; font-size: 13px; min-width: 200px; font-weight: 600; color: #4338ca; background: #eef2ff;">
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
      <div class="metric-total">Total Clients: <strong>{$metrics.pipeline.total}</strong></div>
    </div>

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
        <div class="metric-card" style="border-left: 4px solid #6366f1">
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
              <div class="monthly-bar__fill" style="height: {Math.min(100, (snap.totalCost / Math.max(...$metrics.llmCosts.weeklySnapshots.map(s => s.totalCost), 0.001)) * 100)}%; background: #6366f1;"></div>
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
            <div class="metric-card" style="border-left: 4px solid {provider === 'openrouter' ? '#f97316' : provider === 'google' ? '#3b82f6' : '#8b5cf6'}">
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
          <div class="metric-card" style="border-left: 4px solid #6366f1">
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
        <h2>Monthly Leads</h2>
        <div class="monthly-chart">
          {#each Object.entries($metrics.monthlyLeads).sort() as [month, count]}
            <div class="monthly-bar">
              <div class="monthly-bar__fill" style="height: {Math.min(100, (count / Math.max(...Object.values($metrics.monthlyLeads))) * 100)}%"></div>
              <span class="monthly-bar__count">{count}</span>
              <span class="monthly-bar__label">{month}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Monthly Paid Users -->
    {#if $metrics.monthlyPaidUsers && Object.keys($metrics.monthlyPaidUsers).length > 0}
      <div class="metrics-section">
        <h2>💳 Monthly Paid Users</h2>
        <div class="metric-total" style="margin-bottom: 12px;">
          Total paid clients: <strong>{Object.values($metrics.monthlyPaidUsers).reduce((a, b) => a + b, 0)}</strong>
        </div>
        <div class="monthly-chart">
          {#each Object.entries($metrics.monthlyPaidUsers).sort() as [month, count]}
            <div class="monthly-bar">
              <div class="monthly-bar__fill" style="height: {Math.min(100, (count / Math.max(...Object.values($metrics.monthlyPaidUsers))) * 100)}%; background: linear-gradient(180deg, #10b981, #059669);"></div>
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