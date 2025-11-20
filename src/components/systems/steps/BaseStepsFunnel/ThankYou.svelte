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
    import { isBirthdayValid, isBudgetValid, isPropertyTypeFromValid, isPropertyTypeToValid, isSquareFeetValid } from "../../helpers/validationRules.ts";
    import ReasonInputSubmitStage from "./stages/ReasonInputSubmitStage.svelte";

  // Define the sequence of components and their conditions
  // Define the sequence of components and their conditions
  const components = [
    // I'm thinking that there could be a conditional 
    // these stages can show if they are not set already on the store so we do a spread of a conditional of spread
    // and we if all are present, submit, if one is not present, show it, and but capture the data as soon as it lands here
    // and then on capture the rest you save it on the server, and regardless of how much the user fills, you save the info at each stage
    // and then the server sends that data fo firestore
    ...[
      $store.propertyTypeFrom ? undefined : [[() => true, PropertyTypeFromInputStage]],
      $store.propertyTypeTo ? undefined : [[isPropertyTypeFromValid, PropertyTypeToInputStage]],
      $store.squareFeet ? undefined : [[isPropertyTypeToValid, SquareFeetInputStage]],
      $store.budget ? undefined : [[isSquareFeetValid, BudgetInputStage]],
      $store.age ? undefined : [[isBudgetValid, AgeInputStage]],
      $store.reasons ? undefined : [[isBirthdayValid, ReasonInputSubmitStage]],
    ].filter(Boolean).flat(),
    [() => true, ThankYou], // VSL always shows first (assuming ThankYou here is the VSL component)
    // New Order:
    // TODO: Make the Thank You The Input and then redirect to IRP new web
  ];
</script>

<StepsTowardsPublish {components} />
