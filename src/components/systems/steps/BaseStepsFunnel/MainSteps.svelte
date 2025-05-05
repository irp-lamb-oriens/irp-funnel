<script lang="ts">
  import type { Store } from "../../../types.ts";
  import store, { saveToStore } from "../../../store.ts";
  import StepsTowardsPublish from "./StepsTowardsPublish.svelte";
  import VSL from "./stages/VSL.svelte";
  import NameInputStage from "./stages/NameInputStage.svelte";
  import EmailInputStage from "./stages/EmailInputStage.svelte";
  import AgeInputStage from "./stages/AgeInputStage.svelte";
  import SexInputStage from "./stages/SexInputStage.svelte";
  import BudgetInputStage from "./stages/BudgetInputStage.svelte";
  import CountryFromInputStage from "./stages/CountryFromInputStage.svelte";
  import CountryToInputStage from "./stages/CountryToInputStage.svelte";
  import ReasonInputStage from "./stages/ReasonInputStage.svelte";
  import SubmitStage from "./stages/SubmitStage.svelte";
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  // Condition functions based on store state
  const isNameValid = () => !!get(store).name?.trim();
  const isEmailValid = () => !!get(store).email?.trim();
  const isAgeValid = () => get(store).age !== null && get(store).age > 0;
  const isSexValid = () => get(store).sex === "Male" || get(store).sex === "Female";
  const isBudgetValid = () => get(store).budget !== null && get(store).budget >= 0;
  const isCountryFromValid = () => !!get(store).countryFrom;
  const isCountryToValid = () => !!get(store).countryTo;
  const isReasonsValid = () => Array.isArray(get(store).reasonsForMoving) && get(store).reasonsForMoving.length > 0 && get(store).reasonsForMoving.some((r: string) => r.trim() !== '');

  // Define the sequence of components and their conditions
  const components = [
    [() => true, VSL], // VSL always shows first
    [() => true, NameInputStage], // Name input follows VSL
    [isNameValid, EmailInputStage], // Email input requires a valid name
    [isEmailValid, AgeInputStage], // Age input requires a valid email
    [isAgeValid, SexInputStage], // Sex input requires a valid age
    [isSexValid, BudgetInputStage], // Budget requires a valid sex
    [isBudgetValid, CountryFromInputStage], // Country From requires a valid budget
    [isCountryFromValid, CountryToInputStage], // Country To requires a valid Country From
    [isCountryToValid, ReasonInputStage], // Reason requires a valid Country To
    [isReasonsValid, SubmitStage], // Submit stage requires at least one reason
  ];
</script>

<StepsTowardsPublish {components} />
