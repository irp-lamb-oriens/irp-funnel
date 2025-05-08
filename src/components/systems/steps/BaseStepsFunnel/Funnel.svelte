<script lang="ts">
  import StepsTowardsPublish from "./StepsTowardsPublish.svelte";
  import VSL from "./stages/VSL.svelte";
  import ZohoScheduling from "./stages/ZohoScheduling.svelte";

  // Define the sequence of components and their conditions
  const components = [
    [() => true, VSL], // VSL always shows first
    [() => true, ZohoScheduling], // ZohoScheduling follows VSL
  ];
</script>

<StepsTowardsPublish {components} />
