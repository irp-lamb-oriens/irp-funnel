<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  // State management for form inputs
  const email = writable("");
  const name = writable("");
  const topCountries = writable(["", "", ""]);
  const funnelType = writable("");

  let submitError: string | null = null;
  let submitSuccess = false;
  let isLoading = false;

  async function handleSubmit() {
    isLoading = true;
    submitError = null;
    submitSuccess = false;

    const payload = {
      email: $email,
      name: $name,
      topCountries: $topCountries,
      funnelType: $funnelType,
    };

    try {
      const response = await fetch("/api/capture-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      submitSuccess = true;
    } catch (error) {
      console.error("Submission failed:", error);
      submitError = error instanceof Error ? error.message : "An unknown error occurred during submission.";
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="form-container">
  <h2>Capture Data Form</h2>
  {#if submitSuccess}
    <p>Data captured successfully!</p>
  {:else if submitError}
    <p style="color: red;">{submitError}</p>
  {/if}
  <form on:submit|preventDefault={handleSubmit}>
    <label>
      Email:
      <input type="email" bind:value={$email} required />
    </label>
    <label>
      Name:
      <input type="text" bind:value={$name} required />
    </label>
    <label>
      Top 3 Countries to Visit:
      <input type="text" bind:value={$topCountries[0]} placeholder="Country 1" required />
      <input type="text" bind:value={$topCountries[1]} placeholder="Country 2" required />
      <input type="text" bind:value={$topCountries[2]} placeholder="Country 3" required />
    </label>
    <label>
      Funnel Type:
      <input type="text" bind:value={$funnelType} required />
    </label>
    <button type="submit" disabled={isLoading}>Submit</button>
  </form>
</div>

<style>
  .form-container {
    max-width: 400px;
    margin: auto;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 8px;
    background-color: #f9f9f9;
  }
  label {
    display: block;
    margin-bottom: 10px;
  }
  input {
    width: 100%;
    padding: 8px;
    margin-top: 4px;
    margin-bottom: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  button {
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:disabled {
    background-color: #ccc;
  }
</style>
