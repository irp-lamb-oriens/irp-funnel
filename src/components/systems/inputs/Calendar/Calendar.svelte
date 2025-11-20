<script lang="ts">
  import { onMount } from "svelte";
  import { writable, get } from "svelte/store";
  import { formState, updateField } from "./formStore.js";
  import store from "../../../store.ts";
  import TagNode from "./TagNode.svelte";

  const availableDatesStore = writable<{ date: string; availableHours: { name: string; children: { name: string; value: string }[] }[] }[]>([]);
  const errorLoading = writable<string | null>(null);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedDate = writable<string | null>(null);
  const selectedHours = writable<string[]>([]);
  let selectedSegment = writable<string | null>(null);

  let calendarDays: { date: string; isAvailable: boolean }[] = [];
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let emptyStartCells = 0;

  availableDatesStore.subscribe(dates => {
    if (dates.length > 0) {
      updateCalendar();
    }
  });

  function updateCalendar() {
    const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    emptyStartCells = firstDayOfMonth.getUTCDay();
    
    calendarDays = [];
    const availableDates = get(availableDatesStore);

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(Date.UTC(currentYear, currentMonth, day));
      const formattedDate = currentDate.toISOString().split("T")[0];
      const availableDate = availableDates.find(d => d.date === formattedDate);
      calendarDays.push({
        date: formattedDate,
        isAvailable: !!availableDate,
      });
    }
  }

  function selectDate(date: string, isAvailable: boolean) {
    if (isAvailable) {
      selectedDate.set(get(selectedDate) === date ? null : date);
      selectedHours.set([]);
      selectedSegment.set(null);
      updateField([], "scheduling");
    }
  }

  function toggleHour(hour: string) {
    console.log("Toggling hour:", hour);
    selectedHours.update(hours => {
      const index = hours.indexOf(hour);
      if (index > -1) {
        return hours.filter(h => h !== hour);
      } else {
        return [hour];
      }
    });
    updateField(get(selectedHours), "scheduling");
  }

  function nextMonth() {
    currentMonth = (currentMonth + 1) % 12;
    if (currentMonth === 0) {
      currentYear++;
    }
    updateCalendar();
  }

  function previousMonth() {
    currentMonth = (currentMonth - 1 + 12) % 12;
    if (currentMonth === 11) {
      currentYear--;
    }
    updateCalendar();
  }

  async function loadAvailableDates() {
    console.log("Generating available dates...");
    try {
      const datesWithHours: { [key: string]: { name: string; children: { name: string; value: string }[] }[] } = {};
      const startOfDay = getStartDate();
      const endOfYear = new Date(Date.UTC(startOfDay.getUTCFullYear() + 1, 11, 31));

      for (let d = new Date(startOfDay); d <= endOfYear; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
        const dateKey = d.toISOString().split("T")[0];
        datesWithHours[dateKey] = [
          { name: "Morning", children: [] },
          { name: "Afternoon", children: [] },
          { name: "Evening", children: [] },
        ];

        for (let hour = 9; hour <= 16.5; hour += 0.5) {
          const availableTime = new Date(d);
          availableTime.setUTCHours(hour, (hour % 1) * 60, 0, 0);
          const timeString = availableTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Costa_Rica'
          });
          const isoString = availableTime.toISOString();

          if (hour < 12) {
            datesWithHours[dateKey][0].children.push({ name: timeString, value: isoString });
          } else if (hour < 17) {
            datesWithHours[dateKey][1].children.push({ name: timeString, value: isoString });
          } else {
            datesWithHours[dateKey][2].children.push({ name: timeString, value: isoString });
          }
        }
      }

      const formattedDates = Object.entries(datesWithHours).map(([date, availableHours]) => ({
        date,
        availableHours: availableHours.filter(segment => segment.children.length > 0),
      }));
      availableDatesStore.set(formattedDates);
      console.log("Formatted and stored available dates.");
    } catch (err: any) {
      console.error("Error generating dates:", err);
      errorLoading.set("Failed to load available dates. Please try again later.");
    }
  }

  onMount(loadAvailableDates);

  function convertToCST(date: Date): Date {
    const offset = -6 * 60;
    const localDate = new Date(date.getTime() + offset * 60 * 1000);
    return localDate;
  }

  function getStartDate(): Date {
    let date = convertToCST(new Date());
    let workingDaysToAdd = 2;

    while (workingDaysToAdd > 0) {
      date.setUTCDate(date.getUTCDate() + 1);
      const dayOfWeek = date.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDaysToAdd--;
      }
    }
    return date;
  }
</script>

<div class="calendar-container">
  {#if $errorLoading}
    <div class="error-message">{$errorLoading}</div>
  {:else if !$availableDatesStore.length}
    <p>Loading...</p>
  {:else}
    <div class="calendar-header">
      <button on:click={previousMonth}>&lt;</button>
      <span>{new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
      <button on:click={nextMonth}>&gt;</button>
    </div>
    <div class="calendar-weekdays">
      {#each weekDays as day}
        <div>{day}</div>
      {/each}
    </div>
    <div class="calendar-grid">
      {#each Array(emptyStartCells) as _}
        <div />
      {/each}
      {#each calendarDays as day}
        <button
          class="calendar-day"
          class:available={day.isAvailable}
          class:selected={get(selectedDate) === day.date}
          disabled={!day.isAvailable}
          on:click={() => selectDate(day.date, day.isAvailable)}
        >
          {parseInt(day.date.split("-")[2])}
        </button>
      {/each}
    </div>
    {#if $selectedDate}
      <div class="time-slot-sidebar">
        <p>Available hours for {$selectedDate}</p>
        <div class="time-slot-list">
          <div class="segment-buttons">
            {#each get(availableDatesStore).find(d => d.date === $selectedDate)?.availableHours || [] as segment}
              <button class="segment-button" class:selected={$selectedSegment === segment.name} on:click={() => selectedSegment.set(segment.name)}>
                {segment.name}
              </button>
            {/each}
          </div>

          {#if $selectedSegment}
            <div class="tags-container">
              {#each get(availableDatesStore).find(d => d.date === $selectedDate)?.availableHours.find(s => s.name === $selectedSegment)?.children || [] as hour}
                <TagNode node={hour} selectedTags={selectedHours} toggleTag={toggleHour} />
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  .calendar-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 350px;
    margin: auto;
    padding: 1rem;
    border: 1px solid var(--color-outline);
    border-radius: 8px;
  }
  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    button {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 1.5rem;
    }
  }
  .calendar-weekdays, .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
  }
  .calendar-grid {
    gap: 5px;
  }
  .calendar-day {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: transparent;
    cursor: pointer;
    &.available {
      &:hover { background-color: #f0f0f0; }
    }
    &.selected {
      background-color: var(--color-highlight-1);
      color: white;
    }
    &:disabled {
      color: #ccc;
      cursor: not-allowed;
    }
  }
  .time-slot-sidebar {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-outline);
  }
  .time-slot-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .segment-buttons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .segment-button {
    padding: 8px 16px;
    border-radius: 20px;
    border: 1px solid #ccd0d5;
    background-color: #ffffff;
    color: #050505;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease-in-out;

    &:hover {
      background-color: #e4e6eb;
    }

    &.selected {
      background-color: #1877f2;
      color: #ffffff;
      border-color: #1877f2;

      &:hover {
        background-color: #166fe5;
      }
    }
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .time-slot-checkbox {
    display: none;
  }
  .time-slot-label {
    padding: 8px;
    border: 1px solid var(--color-outline);
    border-radius: 4px;
    cursor: pointer;
    text-align: center;
    &.selected {
      background-color: var(--color-highlight-1);
      color: white;
    }
  }
  .error-message {
    color: red;
  }
</style>
