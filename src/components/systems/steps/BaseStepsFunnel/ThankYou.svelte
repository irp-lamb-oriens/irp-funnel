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

  // Validate birthday: must be a string in YYYY-MM-DD, not in the future, not before 1920-01-01, and age > 0
  const isBirthdayValid = () => {
    return !!get(store).age && get(store).age > 0;
  };
  // const isSexValid = () => get(store).sex === "Male" || get(store).sex === "Female";
  const isBudgetValid = () => typeof get(store).budget === 'number';
  const isSquareFeetValid = () => typeof get(store).squareFeet === 'number'; // Includes -1 for "don't know"
  const isPropertyTypeFromValid = () => !!get(store).propertyTypeFrom;
  const isPropertyTypeToValid = () => !!get(store).propertyTypeTo;

  const isReasonsValid = () => Array.isArray(get(store).reasonsForMoving) && get(store).reasonsForMoving.length > 0 && get(store).reasonsForMoving.some((r: string) => r.trim() !== '');

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
