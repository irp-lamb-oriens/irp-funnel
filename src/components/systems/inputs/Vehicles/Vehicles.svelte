<script lang="ts">
  import { onMount, tick } from "svelte";
  import IconButton from "../../buttons/IconButton/IconButton.svelte";
  import PlainText from "../../inputs/PlainText/PlainText.svelte";
  import { fade, slide } from "svelte/transition";
  import fuzzysort from "fuzzysort";

  // Type definitions
  interface Vehicle {
    year: string;
    make: string;
    model: string;
  }

  interface Make {
    make_id: string;
    make_display: string;
    make_is_common: string;
    make_country: string;
  }

  interface Model {
    model_name: string;
    model_make_id: string;
  }

  // Props
  export let vehicles: Vehicle[] = [];
  export let onUpdate: (vehicles: Vehicle[]) => void = () => {};

  // State for each vehicle row to manage dropdowns
  let vehicleStates: any[] = [];
  let inputElements: HTMLInputElement[] = [];

  // Initialize first vehicle if empty
  if (vehicles.length === 0) {
    addVehicle();
  }

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

  // JSONP Helper
  function jsonp(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
      const script = document.createElement("script");
      
      // Append callback parameter
      const delimiter = url.indexOf("?") === -1 ? "?" : "&";
      script.src = `${url}${delimiter}callback=${callbackName}`;
      script.async = true;

      (window as any)[callbackName] = (data: any) => {
        resolve(data);
        document.body.removeChild(script);
        delete (window as any)[callbackName];
      };

      script.onerror = () => {
        reject(new Error("JSONP request failed"));
        document.body.removeChild(script);
        delete (window as any)[callbackName];
      };

      document.body.appendChild(script);
    });
  }

  async function fetchMakes(index: number) {
    const year = vehicles[index].year;
    if (!year || year.length < 4) return;

    vehicleStates[index].loadingMakes = true;
    vehicleStates[index].error = null;
    vehicleStates[index].makes = [];

    try {
      const response = await jsonp(
        `https://www.carqueryapi.com/api/0.3/?cmd=getMakes&year=${year}`
      );
      if (response && response.Makes) {
        vehicleStates[index].makes = response.Makes;
      }
    } catch (e) {
      console.error("Failed to fetch makes", e);
      vehicleStates[index].error = "Could not load vehicle brands. Please type manually.";
    } finally {
      vehicleStates[index].loadingMakes = false;
      // Force reactivity
      vehicleStates = [...vehicleStates];
    }
  }

  async function fetchModels(index: number) {
    const year = vehicles[index].year;
    const make = vehicles[index].make;
    
    if (!year || !make) return;

    // Find make ID if possible, otherwise use name (API takes ID usually lowercase slug)
    // The API returns make_id which is usually lowercase
    const selectedMakeObj = vehicleStates[index].makes.find(
        (m: Make) => m.make_display.toLowerCase() === make.toLowerCase()
    );
    const makeId = selectedMakeObj ? selectedMakeObj.make_id : make.toLowerCase().replace(/ /g, '-');

    vehicleStates[index].loadingModels = true;
    vehicleStates[index].error = null;
    vehicleStates[index].models = [];

    try {
      const response = await jsonp(
        `https://www.carqueryapi.com/api/0.3/?cmd=getModels&make=${makeId}&year=${year}`
      );
      if (response && response.Models) {
        vehicleStates[index].models = response.Models;
      }
      
      if (vehicleStates[index].models.length === 0) {
         vehicleStates[index].error = "No models found for this year/brand combination. Please type manually.";
      }

    } catch (e) {
      console.error("Failed to fetch models", e);
      vehicleStates[index].error = "Could not load models. Please type manually.";
    } finally {
      vehicleStates[index].loadingModels = false;
      vehicleStates = [...vehicleStates];
    }
  }

  function handleYearChange(index: number, val: string) {
    vehicles[index].year = val;
    vehicles[index].make = "";
    vehicles[index].model = "";
    vehicleStates[index].makes = [];
    vehicleStates[index].models = [];
    
    if (val.length === 4 && !isNaN(Number(val))) {
        fetchMakes(index);
    }
    onUpdate(vehicles);
  }

  function selectMake(index: number, make: Make) {
    vehicles[index].make = make.make_display;
    vehicles[index].model = "";
    vehicleStates[index].showMakeDropdown = false;
    vehicleStates[index].makeSearch = "";
    fetchModels(index);
    onUpdate(vehicles);
  }

  function selectModel(index: number, model: Model) {
    vehicles[index].model = model.model_name;
    vehicleStates[index].showModelDropdown = false;
    vehicleStates[index].modelSearch = "";
    onUpdate(vehicles);
  }
  
  // Helper to close dropdowns on click outside
  function handleClickOutside(event: MouseEvent) {
    // Implementation simplified: relies on blur/focus management or simple overlay for now
    // For robust dropdowns, we use a backdrop or specific refs. 
    // Here we'll use a simple logic: if click target is not in the dropdown, close it.
  }

  // Filtered lists
  function getFilteredMakes(index: number) {
    const term = vehicleStates[index].makeSearch.toLowerCase();
    if (!term) return vehicleStates[index].makes;
    return fuzzysort.go(term, vehicleStates[index].makes, { key: 'make_display' }).map(r => r.obj);
  }

  function getFilteredModels(index: number) {
    const term = vehicleStates[index].modelSearch.toLowerCase();
    if (!term) return vehicleStates[index].models;
    return fuzzysort.go(term, vehicleStates[index].models, { key: 'model_name' }).map(r => r.obj);
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
                    on:focus={() => vehicleStates[i].showMakeDropdown = true}
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
                                {make.make_display}
                            </li>
                        {/each}
                    </ul>
                {/if}
                 <!-- Overlay to close dropdown -->
                 {#if vehicleStates[i].showMakeDropdown}
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
                                {model.model_name}
                            </li>
                        {/each}
                    </ul>
                {/if}
                 <!-- Overlay to close dropdown -->
                 {#if vehicleStates[i].showModelDropdown}
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
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    padding: 1rem;
    border-radius: 0.5rem;
    position: relative;
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
    padding: 0.75rem 1rem;
    font-size: 1rem;
    background: #f5f5f5;
    border: 1px solid #ccc; /* Standard border */
    border-radius: 8px;
    color: black;
    outline: none;
    transition: border 0.3s ease, box-shadow 0.3s ease;
    
    &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
    }
  }

  .dropdown-list {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    z-index: 50;
    margin-top: 0.25rem;
    padding: 0;
    list-style: none;
  }

  .dropdown-item {
    padding: 0.5rem 1rem;
    cursor: pointer;
    color: #333;
    &:hover {
        background: #f3f4f6;
    }
  }

  .backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 40;
      background: transparent;
  }
  
  .custom-select .dropdown-list {
      z-index: 51; /* Above backdrop */
  }

  .remove-btn {
      align-self: flex-end;
  }

  .error-msg {
      color: #ff4444;
      font-size: 0.85rem;
      margin-top: -0.5rem;
      padding-left: 1rem;
  }

  .spinner {
      position: absolute;
      right: 1rem;
      top: 50%;
      transform: translateY(-50%);
      width: 1rem;
      height: 1rem;
      border: 2px solid #ccc;
      border-top-color: #666;
      border-radius: 50%;
      animation: spin 1s linear infinite;
  }

  @keyframes spin {
      to { transform: translateY(-50%) rotate(360deg); }
  }
  
  .add-btn-wrapper {
      display: flex;
      justify-content: center;
      margin-top: 0.5rem;
  }
</style>
