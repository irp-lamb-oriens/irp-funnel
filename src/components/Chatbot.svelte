<script lang="ts">
  import { onMount, tick } from "svelte";
  import { writable, get } from "svelte/store";
  import log from "./store.js";
  import { formState } from './systems/inputs/Calendar/formStore.js';
    import countries from "./systems/inputs/Country/countries.ts";

  export let initialContext: any = {};
  export let onBackToForm: () => void;
  export let onExtractedFields: (fields: any) => void;
  export let onErrorFallback: () => void;
  export let onChannelSelect: (channel: string) => void;
  export let preferredLanguage: string = 'en';
  
  import { updateField } from "./systems/inputs/Calendar/formStore.js";

  let isDropdownOpen = false;

  const WHATSAPP_PHONE = "+15186227134";

  function getCountryName(code: string): string {
    return countries.find(c => c.code === code)?.name || code;
  }

  function getWhatsAppUrlWithContext(): string {
    const fs = get(formState);
    const parts: string[] = [];
    parts.push(`Hi! I'd like to continue my relocation consultation.`);
    parts.push(`*ID:* ${sessionId}`);
    parts.push(`*Auth:* ${authCode}`);
    
    // Ensure all fields the chatbot cares about are serialized
    const PRIORITY_KEYS = [
      "name", "surname", "email", "phone",
      "originCountry", "originCity", "originZip",
      "destinationCountry", "destinationCity", "destinationZip",
      "budget", "size", "immigrationStatus", "referredBy", "youtubeVideo",
      "propertyTypeFrom", "propertyTypeTo"
    ];

    // Combine them smoothly
    const missingDataParts = [];
    if (fs.name) missingDataParts.push(`*Name:* ${fs.name}${fs.surname ? ' ' + fs.surname : ''}`);
    if (fs.email) missingDataParts.push(`*Email:* ${fs.email}`);
    if (fs.phone) missingDataParts.push(`*Phone:* ${fs.phone}`);
    if (fs.originCountry) missingDataParts.push(`*Moving from:* ${fs.originCity ? fs.originCity + ', ' : ''}${getCountryName(fs.originCountry)}`);
    if (fs.destinationCountry) missingDataParts.push(`*Moving to:* ${fs.destinationCity ? fs.destinationCity + ', ' : ''}${getCountryName(fs.destinationCountry)}`);
    if (fs.budget) missingDataParts.push(`*Budget:* ${fs.budget}`);
    if (fs.size) missingDataParts.push(`*Move size:* ${fs.size}`);
    if (fs.immigrationStatus) missingDataParts.push(`*Immigration status:* ${fs.immigrationStatus}`);
    if (fs.propertyTypeFrom) missingDataParts.push(`*Moving out of:* ${fs.propertyTypeFrom}`);
    if (fs.propertyTypeTo) missingDataParts.push(`*Moving into:* ${fs.propertyTypeTo}`);
    if (fs.referredBy) missingDataParts.push(`*Referred by:* ${fs.referredBy}`);
    if (fs.youtubeVideo) missingDataParts.push(`*YouTube video:* ${fs.youtubeVideo}`);
    if (fs.vehicles && Array.isArray(fs.vehicles) && fs.vehicles.length > 0) missingDataParts.push(`*Vehicles:* ${fs.vehicles.length} added`);

    parts.push(...missingDataParts);
    
    const text = encodeURIComponent(parts.join('\n'));
    return `https://wa.me/${WHATSAPP_PHONE}?text=${text}`;
  }

  let messages = writable<Array<{ role: "user" | "assistant"; content: string; meetingCard?: { calendarLink: string; hangoutLink: string; } }>>([]);
  
  // Sync chat history to global formStore so it persists into CRM upon scheduling
  // We stringify the JSON array immediately so Svelte/Firestore doesn't see it as [[Object object]] arrays.
  messages.subscribe(m => {
    try {
      updateField(JSON.stringify(m), 'chatHistory');
    } catch {
      updateField('[]', 'chatHistory');
    }
  });

  let userInput = "";
  let isTyping = false;
  let isBooked = false;
  let chatContainer: HTMLElement;
  let sessionId = crypto.randomUUID();
  let authCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code for WA handoff

  // --- UPDATED: Ask the LLM to generate the welcome message so it perfectly honors the selected language ---
  onMount(async () => {
    const fs = get(formState);
    isTyping = true;
    
    // Instead of hardcoding English, send an invisible system request asking the bot to introduce itself in the user's chosen language.
    try {
      const apiURL = get(log).apiURL();
      const response = await fetch(`${apiURL}/api/chatbot/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          authCode,
          message: `[SYSTEM COMMAND] Introduce yourself as Lili from IRP and welcome the user. If they have provided their name (${fs.name}), use it. Acknowledge what we know so far (${JSON.stringify(fs)}), and then ask the first missing PRIORITY question to continue. RESPOND ONLY IN THE LANGUAGE CODE: ${preferredLanguage}. Stay completely natural.`,
          context: initialContext,
          preferredLanguage
        })
      });

      if (response.ok) {
        const data = await response.json();
        messages.update(m => {
          if (m.length === 0) return [{ role: "assistant", content: data.response }];
          return m;
        });
      }
    } catch (e) {
      console.error("Welcome message generation failed", e);
      // Fallback
      messages.update(m => {
        if (m.length === 0) return [{ role: "assistant", content: "Hi! Welcome to IRP. How can I help you today?" }];
        return m;
      });
    } finally {
      isTyping = false;
    }
  });

  async function sendMessage() {
    if (!userInput.trim() || isTyping) return;

    const userMsg = userInput;
    userInput = "";
    messages.update(m => [...m, { role: "user", content: userMsg }]);
    isTyping = true;
    
    await tick();
    scrollToBottom();

    try {
      const apiURL = get(log).apiURL();
      const response = await fetch(`${apiURL}/api/chatbot/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          authCode,
          message: userMsg,
          context: initialContext,
          preferredLanguage
        })
      });

      if (!response.ok) throw new Error("Chatbot error");

      const data = await response.json();
      
      // Detect meeting scheduling — show a beautiful card
      const meetingCard = (data.extractedFields?.calendarLink || data.extractedFields?.hangoutLink) 
        ? { calendarLink: data.extractedFields.calendarLink || "", hangoutLink: data.extractedFields.hangoutLink || "" }
        : undefined;
      
      messages.update(m => [...m, { role: "assistant", content: data.response, meetingCard }]);
      if (meetingCard) {
        isBooked = true;
      }
      if (data.extractedFields) {
        onExtractedFields(data.extractedFields);
      }
    } catch (err) {
      console.error(err);
      // Show error message in chat instead of kicking back to choice screen
      messages.update(m => [...m, { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please try again in a moment, or use the form instead." }]);
    } finally {
      isTyping = false;
      await tick();
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
</script>

<div class="chatbot-ui">
  <div class="chatbot-header">
    <button class="back-btn" on:click={onBackToForm}>←</button>
    <div class="header-center">
      <div class="avatar-dropdown-wrapper">
        <button class="avatar-trigger" on:click={() => isDropdownOpen = !isDropdownOpen}>
          <img src="/lili.png" alt="Relocation team" class="header-avatar" />
          <span class="dropdown-chevron">▾</span>
        </button>

        {#if isDropdownOpen}
          <div class="field-dropdown">
            <div class="dropdown-header">Consultation Details</div>
            <div class="field-list">
              {#each Object.entries($formState) as [key, value]}
                {#if value && value !== '' && key !== 'vehicles' && key !== 'scheduling' && key !== 'chatHistory'}
                  <div class="field-item">
                    <span class="field-key">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                    <span class="field-value">{value}</span>
                  </div>
                {/if}
              {/each}
              {#if $formState.vehicles.length > 0}
                <div class="field-item">
                  <span class="field-key">vehicles</span>
                  <span class="field-value">{$formState.vehicles.length} added</span>
                </div>
              {/if}
              {#if $formState.scheduling.length > 0}
                <div class="field-item">
                  <span class="field-key">call scheduled</span>
                  <span class="field-value">yes</span>
                </div>
              {/if}
            </div>
          </div>
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="dropdown-overlay" on:click={() => isDropdownOpen = false}></div>
        {/if}
      </div>
      
      <div class="header-info">
        <h3>Relocation Team</h3>
        <p><span class="online-dot"></span>Online now</p>
      </div>
    </div>
    
    <a class="wa-float-btn" href={getWhatsAppUrlWithContext()} target="_blank" rel="noopener noreferrer" title="Continue on WhatsApp">
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>
  </div>

  <div class="chat-messages" bind:this={chatContainer}>
    {#each $messages as msg}
      <div class="message {msg.role}">
        <div class="bubble">
          {msg.content}
        </div>
        {#if msg.meetingCard}
          <div class="meeting-card">
            <div class="meeting-card__glow"></div>
            <div class="meeting-card__header">
              <div class="meeting-card__icon">🎉</div>
              <div class="meeting-card__title">Consultation Booked!</div>
            </div>
            <div class="meeting-card__body">
              <p class="meeting-card__subtitle">Your call with our relocation expert is confirmed.</p>
              <div class="meeting-card__details">
                {#if $formState.name}
                  <div class="meeting-card__detail">
                    <span class="meeting-card__label">👤</span>
                    <span>{$formState.name}{$formState.surname ? ' ' + $formState.surname : ''}</span>
                  </div>
                {/if}
                {#if $formState.originCountry && $formState.destinationCountry}
                  <div class="meeting-card__detail">
                    <span class="meeting-card__label">✈️</span>
                    <span>{$formState.originCity ? $formState.originCity + ', ' : ''}{getCountryName($formState.originCountry)} → {$formState.destinationCity ? $formState.destinationCity + ', ' : ''}{getCountryName($formState.destinationCountry)}</span>
                  </div>
                {/if}
                {#if $formState.budget}
                  <div class="meeting-card__detail">
                    <span class="meeting-card__label">💰</span>
                    <span>Budget: {$formState.budget}</span>
                  </div>
                {/if}
              </div>
              <div class="meeting-card__actions">
                {#if msg.meetingCard.hangoutLink}
                  <a href={msg.meetingCard.hangoutLink} target="_blank" rel="noopener noreferrer" class="meeting-card__btn meeting-card__btn--meet">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                    Join Google Meet
                  </a>
                {/if}
                {#if msg.meetingCard.calendarLink}
                  <a href={msg.meetingCard.calendarLink} target="_blank" rel="noopener noreferrer" class="meeting-card__btn meeting-card__btn--cal">
                    📅 View in Calendar
                  </a>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/each}
    {#if isTyping}
      <div class="message assistant typing">
        <div class="bubble">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    {/if}
  </div>

  {#if isBooked}
    <div class="chat-input-area booked">
      <div class="booked-message">✅ Consultation booked! Check your email for confirmation.</div>
    </div>
  {:else}
    <div class="chat-input-area">
      <input
        type="text"
        placeholder="Type your message..."
        bind:value={userInput}
        on:keydown={(e) => e.key === "Enter" && sendMessage()}
      />
      <button class="send-btn" on:click={sendMessage} disabled={!userInput.trim() || isTyping}>
        <svg viewBox="0 0 24 24">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  {/if}
</div>

<style lang="scss">
  .chatbot-ui {
    display: flex;
    flex-direction: column;
    height: 500px;
    background: rgba(20, 20, 20, 0.4);
    border-radius: 1.5rem;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .chatbot-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    z-index: 10;

    .back-btn {
      background: none; border: none; color: rgba(255, 255, 255, 0.5);
      cursor: pointer; font-size: 1.1rem; padding: 0.3rem 0.5rem; border-radius: 0.5rem;
      transition: all 0.2s;
      &:hover { color: #fff; background: rgba(255,255,255,0.08); }
    }

    .header-center {
      display: flex; align-items: center; gap: 0.6rem; flex: 1; justify-content: center;
    }

    .avatar-dropdown-wrapper { position: relative; }
    .avatar-trigger {
      background: none; border: none; padding: 0; cursor: pointer;
      display: flex; align-items: flex-end; gap: 2px;
      &:hover .header-avatar { border-color: var(--color-highlight-2); }
    }

    .header-avatar {
      width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
      border: 2px solid rgba(255,255,255,0.15); transition: all 0.2s;
    }

    .dropdown-chevron { color: rgba(255,255,255,0.4); font-size: 0.6rem; margin-bottom: 4px; }

    .field-dropdown {
      position: absolute; top: 100%; left: 0; margin-top: 12px;
      width: 240px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      padding: 0.75rem; z-index: 100;
      animation: dropdownIn 0.2s cubic-bezier(0.23, 1, 0.32, 1);
    }

    @keyframes dropdownIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dropdown-header {
      font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
      color: var(--color-highlight-2); letter-spacing: 0.05em; margin-bottom: 0.5rem;
      padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .field-list { max-height: 200px; overflow-y: auto; }
    .field-item {
      display: flex; flex-direction: column; gap: 2px; padding: 4px 0;
      &:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.03); }
    }
    .field-key { font-size: 0.65rem; color: rgba(255,255,255,0.4); text-transform: capitalize; }
    .field-value { font-size: 0.8rem; color: #fff; font-weight: 500; }

    .dropdown-overlay {
      position: fixed; inset: 0; background: transparent; z-index: 99;
    }

    .header-info {
      text-align: left;
      h3 { margin: 0; font-size: 0.9rem; color: #fff; font-weight: 700; }
      p {
        margin: 0; font-size: 0.7rem; color: rgba(255, 255, 255, 0.5);
        display: flex; align-items: center; gap: 5px;
      }
    }

    .online-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #25d366; display: inline-block;
      animation: onlinePulse 2s ease-in-out infinite;
    }

    .wa-float-btn {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 50%; background: #25d366; color: #fff;
      text-decoration: none; transition: all 0.2s; flex-shrink: 0;
      &:hover { transform: scale(1.1); box-shadow: 0 2px 12px rgba(37,211,102,0.4); }
      svg { width: 18px; height: 18px; }
    }
  }

  @keyframes onlinePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    scrollbar-width: thin;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
  }

  .message {
    display: flex;
    flex-wrap: wrap;
    &.user { justify-content: flex-end; }
    
    .bubble {
      max-width: 80%;
      padding: 0.8rem 1.2rem;
      border-radius: 1.2rem;
      font-size: 0.95rem;
      line-height: 1.4;
      white-space: pre-line;
    }

    &.assistant .bubble {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border-bottom-left-radius: 0.2rem;
    }

    &.user .bubble {
      background: var(--color-highlight-2);
      color: #000;
      border-bottom-right-radius: 0.2rem;
    }
  }

  .chat-input-area {
    padding: 1rem;
    display: flex;
    gap: 0.75rem;
    background: rgba(0, 0, 0, 0.2);

    input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1rem;
      padding: 0.6rem 1rem;
      color: #fff;
      outline: none;
      &:focus { border-color: var(--color-highlight-2); }
    }

    .send-btn {
      background: var(--color-highlight-2);
      color: #000;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      &:hover:not(:disabled) { transform: scale(1.05); filter: brightness(1.1); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    }

    &.booked {
      justify-content: center;
      padding: 0.85rem 1rem;
      .booked-message {
        font-size: 0.85rem;
        color: #10b981;
        font-weight: 600;
        text-align: center;
      }
    }
  }

  .typing .bubble {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
    .dot {
      width: 6px;
      height: 6px;
      background: rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out;
      &:nth-child(1) { animation-delay: -0.32s; }
      &:nth-child(2) { animation-delay: -0.16s; }
    }
  }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1.0); }
  }

  /* ═══ Meeting Confirmation Card ═══ */
  .meeting-card {
    position: relative;
    width: 100%;
    max-width: 92%;
    margin-top: 0.75rem;
    border-radius: 1rem;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(99, 102, 241, 0.08));
    border: 1px solid rgba(16, 185, 129, 0.25);
    animation: cardSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    backdrop-filter: blur(10px);
  }

  .meeting-card__glow {
    position: absolute;
    top: -30%;
    right: -20%;
    width: 60%;
    height: 80%;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
    pointer-events: none;
    filter: blur(20px);
  }

  .meeting-card__header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 1.1rem 0;
    position: relative;
    z-index: 1;
  }

  .meeting-card__icon {
    font-size: 1.8rem;
    animation: celebratePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
  }

  .meeting-card__title {
    font-size: 1.05rem;
    font-weight: 800;
    color: #10b981;
    letter-spacing: -0.02em;
  }

  .meeting-card__body {
    padding: 0.5rem 1.1rem 1rem;
    position: relative;
    z-index: 1;
  }

  .meeting-card__subtitle {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.55);
    margin: 0 0 0.7rem;
    line-height: 1.4;
  }

  .meeting-card__details {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.9rem;
    padding: 0.6rem 0.7rem;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .meeting-card__detail {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .meeting-card__label {
    font-size: 0.9rem;
    flex-shrink: 0;
    width: 1.2rem;
    text-align: center;
  }

  .meeting-card__actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .meeting-card__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border-radius: 0.7rem;
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.23, 1, 0.32, 1);
    border: none;

    &--meet {
      background: linear-gradient(135deg, #10b981, #059669);
      color: #fff;
      box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 24px rgba(16, 185, 129, 0.45);
        filter: brightness(1.1);
      }
    }

    &--cal {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        transform: translateY(-1px);
      }
    }

    svg {
      flex-shrink: 0;
    }
  }

  @keyframes cardSlideIn {
    0% { opacity: 0; transform: translateY(20px) scale(0.95); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes celebratePop {
    0% { transform: scale(0); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
</style>
