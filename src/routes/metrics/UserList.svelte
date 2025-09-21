<script lang="ts">
  import { metricsData } from './store.ts';

  let emailFilter = '';
  let countryFromFilter = '';
  let countryToFilter = '';

  $: filteredUsers = $metricsData ? $metricsData.users.filter(user => {
    const email = user.email || '';
    const countryFrom = user.submit?.Origin_Country || '';
    const countryTo = user.submit?.Destination_Country || '';
    const emailMatch = email.toLowerCase().includes(emailFilter.toLowerCase());
    const countryFromMatch = countryFrom.toLowerCase().includes(countryFromFilter.toLowerCase());
    const countryToMatch = countryTo.toLowerCase().includes(countryToFilter.toLowerCase());
    return emailMatch && countryFromMatch && countryToMatch;
  }) : [];
</script>

<div class="user-list">
  <h2 class="user-list__title">User List</h2>

  <div class="user-list__filters">
    <input class="user-list__filter-input" type="text" placeholder="Filter by email" bind:value={emailFilter} />
    <input class="user-list__filter-input" type="text" placeholder="Filter by Country From" bind:value={countryFromFilter} />
    <input class="user-list__filter-input" type="text" placeholder="Filter by Country To" bind:value={countryToFilter} />
  </div>

  <table class="user-list__table">
    <thead>
      <tr>
        <th>Email</th>
        <th>Country From</th>
        <th>Country To</th>
        <th>Updated At</th>
      </tr>
    </thead>
    <tbody>
      {#if filteredUsers.length > 0}
        {#each filteredUsers as user}
          <tr>
            <td data-label="Email">{user.email || 'N/A'}</td>
            <td data-label="Country From">{user.submit?.Origin_Country || 'N/A'}</td>
            <td data-label="Country To">{user.submit?.Destination_Country || 'N/A'}</td>
            <td data-label="Updated At">{user.updatedAt || 'N/A'}</td>
          </tr>
        {/each}
      {:else}
        <tr>
          <td colspan="4" class="user-list__no-results">No users found.</td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>
