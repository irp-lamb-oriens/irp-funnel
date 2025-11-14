<script lang="ts">
  import { onMount } from "svelte";
  import { writable, get } from "svelte/store";
  import { formState, updateField } from "./formStore.js";
    import store from "../../../store.ts";

  const availableDatesStore = writable<{ date: string; availableHours: string[] }[]>([]);
  const errorLoading = writable<string | null>(null);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedDate = writable<string | null>(null);
  const selectedHours = writable<string[]>([]);

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
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    emptyStartCells = firstDayOfMonth.getDay();
    
    calendarDays = [];
    const availableDates = get(availableDatesStore);

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(currentYear, currentMonth, day);
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
      updateField([], "scheduling");
    }
  }

  function toggleHour(hour: string) {
    selectedHours.update(hours => {
      const index = hours.indexOf(hour);
      if (index > -1) {
        return hours.filter(h => h !== hour);
      } else {
        return [...hours, hour];
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
    console.log("Fetching available dates...");
    try {
      const response = await fetch(get(store).apiURL() + "/api/events");
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to load calendar events. Response:", errorText);
        throw new Error("Failed to load calendar events");
      }

      const events = await response.json();
      console.log("Successfully fetched events:", events);
      const datesWithHours: { [key: string]: string[] } = {};
      const startOfDay = getSkippedDateFromToday(1);
      const endOfYear = new Date(new Date().getFullYear() + 1, 11, 31);

      for (let d = new Date(startOfDay); d <= endOfYear; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        const dateKey = d.toISOString().split("T")[0];
        datesWithHours[dateKey] = [];

        for (let hour = 10; hour <= 16; hour += 1.5) {
          if (hour >= 13 && hour < 14.5) continue;
          
          const availableTime = new Date(d);
          availableTime.setHours(hour, (hour % 1) * 60, 0, 0);
          const timeString = availableTime.toISOString();

          const isBooked = events.some((event: { start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }) => {
            const eventStart = new Date(event.start?.dateTime || event.start?.date || 0).getTime();
            const eventEnd = new Date(event.end?.dateTime || event.end?.date || 0).getTime();
            const selectedTime = availableTime.getTime();
            return selectedTime >= eventStart && selectedTime < eventEnd;
          });

          if (!isBooked) {
            datesWithHours[dateKey].push(timeString);
          }
        }
        if (datesWithHours[dateKey].length === 0) {
          delete datesWithHours[dateKey];
        }
      }

      const formattedDates = Object.entries(datesWithHours).map(([date, availableHours]) => ({ date, availableHours }));
      availableDatesStore.set(formattedDates);
      console.log("Formatted and stored available dates.");
    } catch (err) {
      console.error("Error loading Google Calendar events:", err);
      if (err.response) {
        console.error("API response status:", err.response.status);
        console.error("API response data:", err.response.data);
      }
      errorLoading.set("Failed to load available dates. Please try again later.");
    }
  }

  onMount(loadAvailableDates);

  function getSkippedDateFromToday(daySkip: number = 2): Date {
    const today = new Date();
    today.setDate(today.getDate() + daySkip);
    return today;
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
      <button on:click={nextMonth}>&mt;</button>
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
          {new Date(day.date).getDate() + 1}
        </button>
      {/each}
    </div>
    {#if $selectedDate}
      <div class="time-slot-sidebar">
        <p>Available hours for {$selectedDate}</p>
        <div class="time-slot-list">
          {#each get(availableDatesStore).find(d => d.date === $selectedDate)?.availableHours || [] as hour}
            <label class="time-slot-label" class:selected={$selectedHours.includes(hour)}>
              <input
                type="checkbox"
                class="time-slot-checkbox"
                checked={$selectedHours.includes(hour)}
                on:change={() => toggleHour(hour)}
              />
              {new Date(hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </label>
          {/each}
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
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 10px;
    margin-top: 0.5rem;
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
