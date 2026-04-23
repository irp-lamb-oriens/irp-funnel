<script lang="ts">
  import { onMount } from "svelte";
  import { writable, get } from "svelte/store";
  import { formState, updateField } from "./formStore.js";
  import store from "../../../store.ts";
  import TagNode from "./TagNode.svelte";

  const availableDatesStore = writable<{ date: string; availableHours: { name: string; children: { name: string; value: string; disabled: boolean }[] }[] }[]>([]);
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
      const dayOfWeek = currentDate.getUTCDay();
      // Block weekends (0=Sun, 6=Sat) and Fridays (5)
      const isBlockedDay = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
      const availableDate = availableDates.find(d => d.date === formattedDate);
      calendarDays.push({
        date: formattedDate,
        isAvailable: !isBlockedDay && !!availableDate,
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
      const apiUrl = get(store).apiURL();
      const response = await fetch(`${apiUrl}/api/events`);
      if (!response.ok) throw new Error("Failed to fetch events");
      const events = await response.json();
      const busyTimes = events.map((e: any) => new Date(e.start.dateTime).getTime());

      const datesWithHours: { [key: string]: { name: string; children: { name: string; value: string; disabled: boolean }[] }[] } = {};
      const startOfDay = getStartDate();
      const maxDate = convertToCST(new Date());
      maxDate.setUTCDate(maxDate.getUTCDate() + 14);

      for (let d = new Date(startOfDay); d <= maxDate; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() === 0 || d.getUTCDay() === 5 || d.getUTCDay() === 6) continue;
        const dateKey = d.toISOString().split("T")[0];
        datesWithHours[dateKey] = [
          { name: "Morning", children: [] },
          { name: "Afternoon", children: [] },
          { name: "Evening", children: [] },
        ];

        for (let hour = 9; hour <= 16; hour += 1) {
          const availableTime = new Date(d);
          availableTime.setUTCHours(hour + 6, 0, 0, 0);

          const slotTime = availableTime.getTime();
          // Check for conflicts: 60 minutes buffer (30 min call + 30 min notes)
          // A slot is unavailable if there exists an event such that abs(slotTime - eventTime) < 60 mins
          const isBusy = busyTimes.some((eventTime: number) => Math.abs(slotTime - eventTime) < 60 * 60 * 1000);

          const timeString = availableTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Costa_Rica'
          });
          const isoString = availableTime.toISOString();
          const slot = { name: timeString, value: isoString, disabled: isBusy };

          if (hour < 12) {
            datesWithHours[dateKey][0].children.push(slot);
          } else if (hour < 17) {
            datesWithHours[dateKey][1].children.push(slot);
          } else {
            datesWithHours[dateKey][2].children.push(slot);
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
      if (dayOfWeek !== 0 && dayOfWeek !== 5 && dayOfWeek !== 6) {
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
    max-width: 400px;
    margin: auto;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1.5rem;
    backdrop-filter: blur(10px);
    color: #ffffff;
  }
  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    
    span {
      font-weight: 700;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }

    button {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #ffffff;
      cursor: pointer;
      font-size: 1.25rem;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
      }
    }
  }
  .calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.8rem;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 0.75rem;
  }
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    gap: 8px;
  }
  .calendar-day {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    border: 1px solid transparent;
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &.available {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.1);

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        transform: translateY(-1px);
        color: #fff;
      }
    }

    &.selected {
      background: var(--color-highlight-2);
      color: #000;
      border-color: var(--color-highlight-2);
      font-weight: 700;
      box-shadow: 0 0 15px rgba(var(--color-highlight-2-rgb), 0.3);
    }

    &:disabled {
      color: rgba(255, 255, 255, 0.15);
      cursor: not-allowed;
    }
  }
  .time-slot-sidebar {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);

    p {
      font-size: 0.9rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 1rem;
    }
  }
  .time-slot-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .segment-buttons {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 1rem;
  }

  .segment-button {
    flex: 1;
    padding: 0.5rem;
    border-radius: 0.75rem;
    border: 1px solid transparent;
    background-color: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      color: #ffffff;
    }

    &.selected {
      background-color: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .error-message {
    color: #ef4444;
    font-weight: 500;
    text-align: center;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 1rem;
  }
</style>
