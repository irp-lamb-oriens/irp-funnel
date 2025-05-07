<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import WheelPicker from '../../../selectors/WheelPicker.svelte';

    // Helper functions
    function getDaysInMonth(year: number, month: number) {
        return new Date(year, month + 1, 0).getDate();
    }

    // Years: 1920 to current year, default 1970
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = 1920; y <= currentYear; y++) years.push(y);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    import { writable } from 'svelte/store';

    // Defaults
    let defaultYear = new Date().getFullYear() - 50;
    let defaultMonth = 0; // January
    let defaultDay = 1;

    // If store has a birthday, prefill
    const storeBirthday = get(store).birthday;
    if (storeBirthday) {
        const [y, m, d] = storeBirthday.split('-').map(Number);
        if (y && m && d) {
            defaultYear = y;
            defaultMonth = m - 1;
            defaultDay = d;
        }
    }

    // Writable stores for pickers
    const selectedYear = writable<number>(defaultYear);
    const selectedMonth = writable<number>(defaultMonth);
    const selectedDay = writable<number>(defaultDay);

    // Derived days array
    import { derived } from 'svelte/store';
    const days = derived([selectedYear, selectedMonth], ([$selectedYear, $selectedMonth]) =>
        Array.from({ length: getDaysInMonth($selectedYear, $selectedMonth) }, (_, i) => i + 1)
    );

    // Validation
    import { get as getStore } from 'svelte/store';
    $: isValid = !!getStore(selectedYear) && getStore(selectedMonth) !== undefined && !!getStore(selectedDay);

    // Save to store on change
    function saveBirthday() {
        const y = getStore(selectedYear);
        const m = getStore(selectedMonth);
        const d = getStore(selectedDay);
        // Ensure selectedDay is valid for the month/year
        const maxDay = getDaysInMonth(y, m);
        if (d > maxDay) {
            selectedDay.set(1);
            saveToStore({ birthday: `${y}-${String(m + 1).padStart(2, '0')}-01` });
        } else {
            const birthdayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            saveToStore({ birthday: birthdayStr });
        }
    }

    // React to changes
    selectedYear.subscribe(() => saveBirthday());
    selectedMonth.subscribe(() => saveBirthday());
    selectedDay.subscribe(() => saveBirthday());

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }

    function handleEnter() {
        if (isValid) {
            handleNext();
        }
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText>
            ## What is your birthday?
        </MarkdownText>

        <div class="glassmorphic-picker-container">
            <WheelPicker
                label="Year"
                items={years}
                selectedStore={selectedYear}
                selected={$selectedYear}
            />
            <WheelPicker
                label="Month"
                items={months.map((_, i) => i)}
                selectedStore={selectedMonth}
                selected={$selectedMonth}
                itemToString={(item) => months[item as number]}
            />
            <WheelPicker
                label="Day"
                items={$days}
                selectedStore={selectedDay}
                selected={$selectedDay}
            />
        </div>

        <SubmitButton
            label="Next"
            callback={handleNext}
            disabled={!isValid}
        />
    </div>
</Page>

<style>
.stage-content {
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 40px 20px;
    max-width: 600px;
    margin: auto;
    align-items: center;
}

.glassmorphic-picker-container {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    max-width: 500px;
    margin: 0 auto 24px auto;
}

.picker-wheel {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 100px;
}

.picker-label {
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 8px;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.wheel-list {
    background: rgba(255,255,255,0.18);
    border-radius: 20px;
    box-shadow: 0 4px 30px rgba(0,0,0,0.12);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.3);
    padding: 8px 0;
    max-height: 220px;
    overflow-y: auto;
    min-width: 80px;
    transition: box-shadow 0.2s;
}

.wheel-list:focus {
    box-shadow: 0 0 0 2px #aeeaff;
    outline: none;
}

.wheel-item {
    padding: 10px 0;
    text-align: center;
    font-size: 1.15rem;
    color: #e0e0e0;
    cursor: pointer;
    border-radius: 12px;
    transition: background 0.15s, color 0.15s;
    user-select: none;
}

.wheel-item.selected {
    background: rgba(255,255,255,0.35);
    color: #222;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    border: 1.5px solid #aeeaff;
}

.wheel-item:hover:not(.selected) {
    background: rgba(255,255,255,0.22);
    color: #333;
}

@media (max-width: 600px) {
    .glassmorphic-picker-container {
        flex-direction: column;
        gap: 18px;
        max-width: 100%;
    }
    .picker-wheel {
        min-width: 0;
        width: 100%;
    }
    .wheel-list {
        min-width: 0;
        width: 100%;
    }
}
</style>
