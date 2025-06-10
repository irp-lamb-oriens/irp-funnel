<script lang="ts">
  import type { Store } from "../../../types.ts";
  import store, { saveToStore } from "../../../store.ts";
  import StepsTowardsPublish from "./StepsTowardsPublish.svelte";
  import VSL from "./stages/VSL.svelte";
  import ZohoScheduling from "./stages/ZohoScheduling.svelte";
  import EmailInputStage from "./stages/EmailInputStage.svelte";
  import AgeInputStage from "./stages/AgeInputStage.svelte";
  // import SexInputStage from "./stages/SexInputStage.svelte"; // Already commented out or removed
  import BudgetInputStage from "./stages/BudgetInputStage.svelte";
  import SquareFeetInputStage from "./stages/SquareFeetInputStage.svelte";
  import PropertyTypeFromInputStage from "./stages/PropertyTypeFromInputStage.svelte"; // Import new stage
  import PropertyTypeToInputStage from "./stages/PropertyTypeToInputStage.svelte"; // Import new stage
  import CountryFromInputStage from "./stages/CountryFromInputStage.svelte";
  import CountryToInputStage from "./stages/CountryToInputStage.svelte";
  import ReasonInputStage from "./stages/ReasonInputStage.svelte";
  import SubmitStage from "./stages/SubmitStage.svelte";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import NameInputStage from "./stages/NameInputStage.svelte";
  import ThankYou from "./stages/ThankYou.svelte";
  import {
    isBirthdayValid,
    isBudgetValid,
    isSquareFeetValid,
    isPropertyTypeFromValid,
    isPropertyTypeToValid,
    isReasonsValid
  } from '../../helpers/validationRules.ts'; // Adjusted path

  // Define the sequence of components and their conditions
  // Define the sequence of components and their conditions
  const components = [
    [() => true, ThankYou], // VSL always shows first (assuming ThankYou here is the VSL component)
    // New Order:
    [() => true, PropertyTypeFromInputStage], // Assuming this can start after VSL
    [isPropertyTypeFromValid, PropertyTypeToInputStage],
    [isPropertyTypeToValid, SquareFeetInputStage],
    [isSquareFeetValid, BudgetInputStage],
    [isBudgetValid, AgeInputStage],
    [isBirthdayValid, ReasonInputStage], // Age input now depends on reasons being valid
    [isReasonsValid, SubmitStage], // Submit stage now depends on age (birthday) being valid
  ];
</script>

<StepsTowardsPublish {components} />
