<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import { getAttribution } from "../lib/attribution.ts";

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
      attribution: getAttribution(),
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

<style lang="scss">
  .form-container {
    max-width: 500px;
    margin: 3rem auto;
    padding: 3rem;
    background: rgba(22, 22, 22, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 2rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    color: #ffffff;
  }

  h2 {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 2rem;
    text-align: center;
    background: linear-gradient(to right, #fff, rgba(255, 255, 255, 0.7));
    -webkit-background-clip: text;
  }

  label {
    display: block;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input {
    width: 100%;
    padding: 1rem 1.25rem;
    margin-top: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    color: #ffffff;
    font-size: 1.1rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;

    &::placeholder {
      color: rgba(255, 255, 255, 0.2);
    }

    &:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: #007bff;
      box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.15);
    }
  }

  button {
    width: 100%;
    padding: 1.25rem;
    margin-top: 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 1rem;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);

    &:hover:not(:disabled) {
      background: #0056b3;
      transform: translateY(-2px) scale(1.05);
      box-shadow: 0 8px 25px rgba(0, 123, 255, 0.4);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.3);
      cursor: not-allowed;
      box-shadow: none;
    }
  }

  p {
    padding: 1rem;
    border-radius: 1rem;
    text-align: center;
    margin-bottom: 1.5rem;
    font-weight: 500;

    &[style*="color: red"] {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444 !important;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    &:not([style*="color: red"]) {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
  }
</style>
