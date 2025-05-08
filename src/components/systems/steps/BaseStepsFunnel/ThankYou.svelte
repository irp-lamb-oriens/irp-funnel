<script lang="ts">
  import type { Store } from "../../../types.ts";
  import store, { saveToStore } from "../../../store.ts";
  import StepsTowardsPublish from "./StepsTowardsPublish.svelte";
  import VSL from "./stages/VSL.svelte";
  import ZohoScheduling from "./stages/ZohoScheduling.svelte";
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
  import NameInputStage from "./stages/NameInputStage.svelte";
  import ThankYou from "./stages/ThankYou.svelte";

  // Validate birthday: must be a string in YYYY-MM-DD, not in the future, not before 1920-01-01, and age > 0
  const isBirthdayValid = () => {
    const birthday = get(store).birthday;
    if (typeof birthday !== "string") return false;
    // Regex for YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
    const [year, month, day] = birthday.split("-").map(Number);
    if (
      isNaN(year) ||
      isNaN(month) ||
      isNaN(day) ||
      year < 1920 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    )
      return false;
    const date = new Date(birthday);
    const now = new Date();
    if (date > now) return false;
    // Age calculation
    let age = now.getFullYear() - year;
    const m = now.getMonth() + 1 - month;
    if (m < 0 || (m === 0 && now.getDate() < day)) age--;
    if (age <= 0) return false;
    return true;
  };
  const isSexValid = () => get(store).sex === "Male" || get(store).sex === "Female";
  const isBudgetValid = () => typeof get(store).budget === 'number';

  const isReasonsValid = () => Array.isArray(get(store).reasonsForMoving) && get(store).reasonsForMoving.length > 0 && get(store).reasonsForMoving.some((r: string) => r.trim() !== '');

  // Define the sequence of components and their conditions
  // Define the sequence of components and their conditions
  const components = [
    [() => true, ThankYou], // VSL always shows first
    [() => true, AgeInputStage], // Age input requires a valid email
    [isBirthdayValid, SexInputStage], // Sex input requires a valid birthday
    [isSexValid, BudgetInputStage], // Budget requires a valid sex
    [isBudgetValid, ReasonInputStage], // Reason requires a valid Country To
    [isReasonsValid, SubmitStage], // Submit stage requires at least one reason
  ];
</script>

<StepsTowardsPublish {components} />
