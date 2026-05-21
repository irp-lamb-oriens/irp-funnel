<script lang="ts">
  import { onMount, tick } from "svelte";
  import IconButton from "../../buttons/IconButton/IconButton.svelte";
  import PlainText from "../../inputs/PlainText/PlainText.svelte";
  import { fade, slide } from "svelte/transition";
  import fuzzysort from "fuzzysort";

  // ─── Types ────────────────────────────────────────────────────────────────
  interface Vehicle {
    year: string;
    make: string;
    model: string;
  }

  // ─── Props ────────────────────────────────────────────────────────────────
  export let vehicles: Vehicle[] = [];
  export let onUpdate: (vehicles: Vehicle[]) => void = () => {};

  // ─── Module-level cache (shared across all instances / rows) ─────────────
  // Fetched once on first component mount; subsequent rows reuse the same data.
  // Cascade: primary → fallback → manual (empty object → user types freely).

  const _PRIMARY_URL =
    "https://raw.githubusercontent.com/DanielKohut/car-data/refs/heads/main/car_data.json";
  const _FALLBACK_URL =
    "https://raw.githubusercontent.com/LuisArmando-TestCoder/car-data/refs/heads/main/car_data.json";

  let _carDataCache: Record<string, string[]> | null = null;
  let _carDataPromise: Promise<Record<string, string[]>> | null = null;

  /** Fixes a common authoring bug: missing comma between array-value properties.
   *  ]\n    "NextKey"  →  ],\n    "NextKey"
   *  Safe no-op when the JSON is already valid.
   */
  function _repairJson(raw: string): Record<string, string[]> {
    const fixed = raw.replace(/\]\s*\n(\s*")/g, "],\n$1");
    const parsed = JSON.parse(fixed) as { brands: Record<string, string[]> };
    return parsed.brands;
  }

  async function _fetchAndRepair(url: string): Promise<Record<string, string[]>> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.text();
    return _repairJson(raw);
  }

  function getCarData(): Promise<Record<string, string[]>> {
    if (_carDataCache) return Promise.resolve(_carDataCache);
    if (!_carDataPromise) {
      _carDataPromise = _fetchAndRepair(_PRIMARY_URL)
        .catch(() => _fetchAndRepair(_FALLBACK_URL))
        .then((brands) => {
          _carDataCache = brands;
          return brands;
        })
        .catch(() => {
          // Both sources failed — resolve to empty so user types manually.
          _carDataCache = {};
          return {} as Record<string, string[]>;
        });
    }
    return _carDataPromise;
  }

  // ─── Per-row UI state ─────────────────────────────────────────────────────
  let vehicleStates: {
    makes: string[];
    models: string[];
    loadingMakes: boolean;
    loadingModels: boolean;
    showMakeDropdown: boolean;
    showModelDropdown: boolean;
    makeSearch: string;
    modelSearch: string;
    error: string | null;
  }[] = [];

  let inputElements: HTMLInputElement[] = [];

  // Initialize first vehicle if empty
  if (vehicles.length === 0) addVehicle();

  function addVehicle() {
    vehicles = [...vehicles, { year: "", make: "", model: "" }];
    vehicleStates = [
      ...vehicleStates,
      {
        makes: [],
        models: [],
        loadingMakes: false,
        loadingModels: false,
        showMakeDropdown: false,
        showModelDropdown: false,
        makeSearch: "",
        modelSearch: "",
        error: null,
      },
    ];
    onUpdate(vehicles);
  }

  function removeVehicle(index: number) {
    if (vehicles.length > 1) {
      vehicles = vehicles.filter((_, i) => i !== index);
      vehicleStates = vehicleStates.filter((_, i) => i !== index);
      onUpdate(vehicles);
    }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  // Eagerly pre-fetch so the dropdown is instant when the user opens it.
  onMount(() => { getCarData().catch(() => {}); });

  async function loadMakes(index: number) {
    if (vehicleStates[index].makes.length > 0) return; // already loaded
    vehicleStates[index].loadingMakes = true;
    vehicleStates[index].error = null;
    try {
      const brands = await getCarData();
      vehicleStates[index].makes = Object.keys(brands).sort();
    } catch {
      vehicleStates[index].error = "Could not load vehicle brands. Please type manually.";
    } finally {
      vehicleStates[index].loadingMakes = false;
      vehicleStates = [...vehicleStates];
    }
  }

  async function loadModels(index: number) {
    const make = vehicles[index].make;
    if (!make) return;
    vehicleStates[index].loadingModels = true;
    vehicleStates[index].error = null;
    vehicleStates[index].models = [];
    try {
      const brands = await getCarData();
      vehicleStates[index].models = (brands[make] ?? []).slice().sort();
    } catch {
      vehicleStates[index].error = "Could not load models. Please type manually.";
    } finally {
      vehicleStates[index].loadingModels = false;
      vehicleStates = [...vehicleStates];
    }
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  function handleYearChange(index: number, val: string) {
    vehicles[index].year = val;
    vehicles[index].make = "";
    vehicles[index].model = "";
    vehicleStates[index].makes = [];
    vehicleStates[index].models = [];
    vehicleStates[index].makeSearch = "";
    vehicleStates[index].modelSearch = "";
    onUpdate(vehicles);
    // Start loading makes when a plausible year is typed
    if (val.length >= 4 && !isNaN(Number(val))) {
      loadMakes(index);
    }
  }

  function selectMake(index: number, make: string) {
    vehicles[index].make = make;
    vehicles[index].model = "";
    vehicleStates[index].showMakeDropdown = false;
    vehicleStates[index].makeSearch = "";
    loadModels(index);
    onUpdate(vehicles);
  }

  function selectModel(index: number, model: string) {
    vehicles[index].model = model;
    vehicleStates[index].showModelDropdown = false;
    vehicleStates[index].modelSearch = "";
    onUpdate(vehicles);
  }

  // ─── Filtered lists ───────────────────────────────────────────────────────

  function getFilteredMakes(index: number): string[] {
    const term = vehicleStates[index].makeSearch.trim();
    if (!term) return vehicleStates[index].makes;
    return fuzzysort.go(term, vehicleStates[index].makes).map((r) => r.target);
  }

  function getFilteredModels(index: number): string[] {
    const term = vehicleStates[index].modelSearch.trim();
    if (!term) return vehicleStates[index].models;
    return fuzzysort.go(term, vehicleStates[index].models).map((r) => r.target);
  }
</script>

<div class="vehicles-container">
  {#each vehicles as vehicle, i}
    <div class="vehicle-row" in:slide|local>

      <!-- Year Input -->
      <div class="input-group year-group">
        <PlainText
          placeholder="Year (e.g. 2015)"
          value={vehicle.year}
          onChange={(val) => handleYearChange(i, val)}
          bind:inputElement={inputElements[i]}
        />
      </div>

      <!-- Make Input -->
      {#if vehicle.year.trim() !== ""}
        <div class="input-group make-group" in:fade>
          <div class="custom-select">
            <input
              type="text"
              placeholder="Brand / Make"
              bind:value={vehicles[i].make}
              on:focus={() => { loadMakes(i); vehicleStates[i].showMakeDropdown = true; }}
              on:input={(e) => {
                vehicles[i].make = e.currentTarget.value;
                vehicleStates[i].makeSearch = e.currentTarget.value;
                vehicleStates[i].showMakeDropdown = true;
                onUpdate(vehicles);
              }}
              class="control-input"
            />
            {#if vehicleStates[i].loadingMakes}
              <div class="spinner"></div>
            {/if}
            {#if vehicleStates[i].showMakeDropdown && vehicleStates[i].makes.length > 0}
              <ul class="dropdown-list" transition:slide>
                {#each getFilteredMakes(i) as make}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <li class="dropdown-item" on:click={() => selectMake(i, make)}>
                    {make}
                  </li>
                {/each}
              </ul>
            {/if}
            {#if vehicleStates[i].showMakeDropdown}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div class="backdrop" on:click={() => vehicleStates[i].showMakeDropdown = false}></div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Model Input -->
      {#if vehicle.make.trim() !== ""}
        <div class="input-group model-group" in:fade>
          <div class="custom-select">
            <input
              type="text"
              placeholder="Model"
              bind:value={vehicles[i].model}
              on:focus={() => vehicleStates[i].showModelDropdown = true}
              on:input={(e) => {
                vehicles[i].model = e.currentTarget.value;
                vehicleStates[i].modelSearch = e.currentTarget.value;
                vehicleStates[i].showModelDropdown = true;
                onUpdate(vehicles);
              }}
              class="control-input"
            />
            {#if vehicleStates[i].loadingModels}
              <div class="spinner"></div>
            {/if}
            {#if vehicleStates[i].showModelDropdown && vehicleStates[i].models.length > 0}
              <ul class="dropdown-list" transition:slide>
                {#each getFilteredModels(i) as model}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <li class="dropdown-item" on:click={() => selectModel(i, model)}>
                    {model}
                  </li>
                {/each}
              </ul>
            {/if}
            {#if vehicleStates[i].showModelDropdown}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div class="backdrop" on:click={() => vehicleStates[i].showModelDropdown = false}></div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Remove Button -->
      {#if vehicles.length > 1}
        <div class="remove-btn">
          <IconButton src="./icons/trash.svg" callback={() => removeVehicle(i)} />
        </div>
      {/if}
    </div>

    {#if vehicleStates[i].error}
      <div class="error-msg" in:slide>{vehicleStates[i].error}</div>
    {/if}
  {/each}

  <div class="add-btn-wrapper">
    <IconButton src="./icons/plus.svg" callback={addVehicle} label="Add Another Vehicle" />
  </div>
</div>

<style lang="scss">
  .vehicles-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .vehicle-row {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: rgba(255, 255, 255, 0.03);
    padding: 1.5rem;
    border-radius: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    position: relative;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
    }
  }

  .input-group {
    width: 100%;
    position: relative;
  }

  .custom-select {
    position: relative;
    width: 100%;
  }

  .control-input {
    width: 100%;
    padding: 1rem 1.25rem;
    font-size: 1.1rem;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    color: #ffffff;
    outline: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }

    &:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--color-highlight-2);
      box-shadow: 0 0 0 4px rgba(var(--color-highlight-2-rgb), 0.15);
    }
  }

  .dropdown-list {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
    background: rgba(25, 25, 25, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.25rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    padding: 0.5rem;
    list-style: none;

    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
  }

  .dropdown-item {
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
  }

  .backdrop {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    z-index: 40;
    background: transparent;
  }

  .custom-select .dropdown-list { z-index: 51; }

  .remove-btn { align-self: flex-end; }

  .error-msg {
    color: #ef4444;
    font-size: 0.85rem;
    font-weight: 500;
    margin-top: 0.25rem;
    padding-left: 1rem;
  }

  .spinner {
    position: absolute;
    right: 1.25rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-highlight-2);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }

  .add-btn-wrapper {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
  }
</style>
