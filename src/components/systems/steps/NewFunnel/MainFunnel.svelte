<script lang="ts">
  import EmailInputStage from "./EmailInputStage.svelte";
  import NameInputStage from "./NameInputStage.svelte";
  import TopCountriesInputStage from "./TopCountriesInputStage.svelte";
  import { email, name, topCountries } from "./store.ts";
  import SubmitStage from "./SubmitStage.svelte";
import StepsTowardsPublish from "../BaseStepsFunnel/StepsTowardsPublish.svelte";
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  // Define the sequence of components and their conditions
  const components = [
    [() => true, EmailInputStage],
    [() => get(email), NameInputStage],
    [() => get(name), TopCountriesInputStage],
    [() => get(topCountries).length > 0, SubmitStage],
  ];

  onMount(() => {
    console.log("MainFunnel mounted");
  });
</script>

<StepsTowardsPublish {components} />

<style>
  .funnel-container {
    max-width: 600px;
    margin: auto;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 8px;
    background-color: #f9f9f9;
  }
  button {
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
