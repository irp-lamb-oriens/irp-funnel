<script lang="ts">
  /**
   * FieldValueViewer.svelte
   * ────────────────────────────────────────────────────────────────────────
   *
   *  Why this component exists
   *  ──────────────────────────
   *  The dashboard's "Advanced fields" accordion used to dump every Firestore
   *  value through <EditableField>, which fell back to `JSON.stringify(v)` for
   *  arrays and objects. Operators saw walls of raw JSON instead of beautiful
   *  data. This component is the **honest renderer**: it inspects the value's
   *  shape and produces a typed, pretty UI for it — recursively.
   *
   *  Rendering rules (priority order)
   *  ────────────────────────────────
   *    1. Special-case keys we know:
   *         transcript / notes.text / *.text  → <PrettyTranscript> block
   *         hangoutLink / htmlLink / *Link    → branded link button
   *         iCalUID                           → mono code chip
   *         eventId, docId, sessionId         → mono code chip (truncated)
   *         meetCode                          → big bold pill
   *         startTime / endTime / *At         → relative + exact time
   *         email                             → mailto: link
   *         phone                             → tel: link
   *
   *    2. By type:
   *         string                            → <EditableField> (1-line)
   *         long string (>120 chars)          → <EditableField multiline>
   *         number / boolean                  → <EditableField>
   *         null / undefined                  → muted "—"
   *         array of primitives               → row of pill chips
   *         array of objects                  → numbered card list, each recurses
   *         object                            → nested key→value table, recurses
   *
   *  Editing
   *  ───────
   *  Primitives go through <EditableField> with a dotted `path` prop, so any
   *  click-to-edit anywhere in the tree flows through the schema-agnostic
   *  PATCH /clients/:id/field endpoint. Editing whole subtrees is intentionally
   *  blocked (the `readonly` flag is plumbed top-down for fields like
   *  `lastCalendarEvent.notes.text` whose source of truth is Gemini, not the
   *  operator).
   *
   *  This component imports itself recursively (`<svelte:self>`).
   */

  import EditableField from './EditableField.svelte';
  import { humanizeFieldLabel } from '../store.ts';
  import { exactTime, relativeTime } from '../utils/relativeTime.ts';

  /** Client document id — needed by <EditableField> for PATCH calls. */
  export let clientId: string;
  /** Dotted Firestore path to this value (e.g. "lastCalendarEvent.notes.text"). */
  export let path: string;
  /** The raw value at `path`. Could be anything Firestore-serializable. */
  export let value: unknown;
  /** Display label. Defaults to `humanizeFieldLabel(lastSegmentOfPath)`. */
  export let label: string | undefined = undefined;
  /** When true, all primitive descendants render as read-only text. */
  export let readonly = false;
  /** Recursion depth — used to clamp visual nesting indents and scrollers. */
  export let depth = 0;

  $: leafKey = (path || '').split('.').pop() || path;
  $: resolvedLabel = label ?? humanizeFieldLabel(leafKey);

  // ── value-shape probes ───────────────────────────────────────────────────
  $: isNullish = value === null || value === undefined;
  $: isPrimitive = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  $: isArray = Array.isArray(value);
  $: isObject = !isArray && !isPrimitive && !isNullish && typeof value === 'object';
  $: isLongString = typeof value === 'string' && value.length > 120;
  $: hasNewlines = typeof value === 'string' && (value as string).includes('\n');

  // ── special-case detection (key-name driven) ─────────────────────────────
  $: looksLikeTranscript =
    typeof value === 'string' &&
    /(transcript|notes\.text|^text$)/i.test(leafKey) &&
    (value as string).length > 200;

  $: looksLikeIsoDate =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value as string);

  $: looksLikeUrl =
    typeof value === 'string' &&
    /^https?:\/\//.test(value as string);

  $: looksLikeEmail =
    typeof value === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string);

  $: looksLikePhone =
    typeof value === 'string' &&
    /^\+?[\d\s().-]{7,}$/.test(value as string);

  $: looksLikeMonoToken =
    typeof value === 'string' &&
    /^(eventId|iCalUID|docId|sessionId|meetCode)$/i.test(leafKey);

  // ── object → entries (sorted: scalars first, then arrays, then objects) ──
  function objectEntries(v: unknown): Array<[string, unknown]> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return [];
    return Object.entries(v as Record<string, unknown>).sort(([ka, va], [kb, vb]) => {
      const score = (x: unknown) =>
        x === null || ['string', 'number', 'boolean'].includes(typeof x)
          ? 0
          : Array.isArray(x)
          ? 1
          : 2;
      return score(va) - score(vb) || ka.localeCompare(kb);
    });
  }

  // ── array primitive-detection: render-as-pills if every item is scalar ──
  $: isArrayOfPrimitives =
    isArray &&
    (value as unknown[]).every((it) => it === null || ['string', 'number', 'boolean'].includes(typeof it));

  // ── Gemini doc parser (the gem) ─────────────────────────────────────────
  //
  // Gemini's "Take notes for me" produces a single text doc that contains
  // BOTH a markdown-ish Notes section and a Transcript section, separated
  // by "📝 Notes" and "📖 Transcript" sentinel lines. Inside the Notes section
  // there are sub-headings (Summary, [Topic], Next steps, Details) and the
  // Details section is bulleted with "* …".
  //
  // This parser is robust to:
  //   • The simpler single-section "Speaker: text" transcripts (Steven Tilton).
  //   • The fuller two-section docs with Notes + Transcript (John Meneses).
  //   • Both transcript formats (inline `Speaker: text` AND the newer
  //     speaker-on-its-own-line / text-on-next-line layout).
  //
  // Output is a structured object that the template renders into proper
  // typography — headings, paragraphs, bullets, chat-bubble turns — instead
  // of dumping raw text inside <pre>.
  type ParsedDoc = {
    preface: string[];               // lines before the first 📝 / 📖 marker
    notes: ParsedNotesBlock | null;  // structured 📝 Notes content
    transcript: ParsedTranscript | null; // structured 📖 Transcript content
    footer: string[];                // trailing disclaimers
  };
  type ParsedNotesBlock = {
    title: string;
    metaLines: string[];             // Invited / Attachments / Meeting records
    sections: Array<{ heading: string; paragraphs: string[]; bullets: string[] }>;
  };
  type ParsedTranscript = {
    title: string;
    timecode: string | null;          // e.g. "00:00:00"
    turns: Array<{ speaker: string; text: string }>;
  };

  // Recognise speaker lines in two flavours:
  //   "Pablo E Arias: hello there"  → inline-colon form
  //   "Pablo E Arias"               → speaker-only form (text on next non-empty line)
  const inlineSpeakerRe = /^([A-Za-zÀ-ÿ' .-]{2,60}?):\s*(.+)$/;
  // Speaker-only line: 1-5 words, all word-ish, no colon, no period at end,
  // not a known section heading. (Heuristic but works for Gemini docs.)
  function isSpeakerOnlyLine(line: string): boolean {
    if (!line) return false;
    if (line.length > 60) return false;
    if (/[:.,;]$/.test(line)) return false;
    if (/^(Summary|Details|Next steps|Attendees|Asistentes|Attachments|Meeting records|Invited|Transcript|Notes)\b/i.test(line)) return false;
    if (/^\d/.test(line)) return false;
    // Must be 1-5 "words" of letters/spaces/hyphens.
    return /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .-]{0,58}$/.test(line) && line.split(/\s+/).length <= 5;
  }

  // Sub-headings inside the Notes section. Anything that looks like a TitleCase
  // sentence on its own line we treat as a new sub-section heading.
  const notesHeadingRe = /^([A-ZÀ-Ý][\w\s&-]{2,60})$/;
  const knownNotesHeadings = new Set([
    'Summary', 'Next steps', 'Next Steps', 'Details', 'Action items', 'Decisions',
  ]);

  function parseGeminiDoc(raw: string): ParsedDoc {
    const out: ParsedDoc = { preface: [], notes: null, transcript: null, footer: [] };
    const lines = raw.split(/\r?\n/).map((l) => l.trim());

    // ── Phase 1: locate the section markers ────────────────────────────────
    let notesIdx = -1;
    let transcriptIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (notesIdx === -1 && /^📝\s*Notes\b/.test(lines[i])) notesIdx = i;
      if (transcriptIdx === -1 && /^📖\s*Transcript\b/.test(lines[i])) transcriptIdx = i;
    }

    // No Gemini doc structure at all → fallback: treat the whole thing as a
    // bare transcript (the original Steven-Tilton-style format).
    if (notesIdx === -1 && transcriptIdx === -1) {
      out.transcript = parseTranscriptBlock(lines, 'Conversation transcript');
      return out;
    }

    // Capture preface (anything before the first marker).
    const firstMarker = Math.min(
      notesIdx === -1 ? Infinity : notesIdx,
      transcriptIdx === -1 ? Infinity : transcriptIdx,
    );
    out.preface = lines.slice(0, firstMarker).filter(Boolean);

    // ── Phase 2: parse Notes block, if any ────────────────────────────────
    if (notesIdx !== -1) {
      const end = transcriptIdx !== -1 && transcriptIdx > notesIdx ? transcriptIdx : lines.length;
      out.notes = parseNotesBlock(lines.slice(notesIdx + 1, end));
    }

    // ── Phase 3: parse Transcript block, if any ──────────────────────────
    if (transcriptIdx !== -1) {
      out.transcript = parseTranscriptBlock(lines.slice(transcriptIdx + 1), '');
    }

    // ── Phase 4: pluck the trailing auto-generated disclaimer ────────────
    if (out.transcript && out.transcript.turns.length) {
      while (
        out.transcript.turns.length &&
        /(finalizó|automáticamente|generated automatically|edited|review)/i.test(
          out.transcript.turns[out.transcript.turns.length - 1].text,
        )
      ) {
        out.footer.push(out.transcript.turns.pop()!.text);
      }
    }
    return out;
  }

  function parseNotesBlock(lines: string[]): ParsedNotesBlock {
    let title = '';
    const metaLines: string[] = [];
    const sections: ParsedNotesBlock['sections'] = [];
    let currentHeading = '';
    let currentParas: string[] = [];
    let currentBullets: string[] = [];

    function commit() {
      if (currentHeading || currentParas.length || currentBullets.length) {
        sections.push({
          heading: currentHeading || '',
          paragraphs: currentParas,
          bullets: currentBullets,
        });
      }
      currentHeading = '';
      currentParas = [];
      currentBullets = [];
    }

    let inHeader = true;   // the first non-empty lines are date + title + meta
    for (const line of lines) {
      if (!line) continue;

      if (inHeader) {
        if (!title) {
          // Skip a leading bare date line ("May 4, 2026").
          if (/^\w+\s+\d+,\s*\d{4}$/.test(line)) continue;
          title = line;
          continue;
        }
        if (/^(Invited|Attachments|Meeting records)\b/.test(line)) {
          metaLines.push(line);
          continue;
        }
        // First non-meta line ends the header.
        inHeader = false;
      }

      // Bullet line (Gemini uses "* " for details).
      if (/^\*\s+/.test(line)) {
        currentBullets.push(line.replace(/^\*\s+/, ''));
        continue;
      }

      // Heading-ish line: a TitleCase phrase on its own (1-7 words, no period).
      const looksHeading =
        knownNotesHeadings.has(line) ||
        (/^[A-ZÀ-Ý]/.test(line) &&
          line.length < 64 &&
          line.split(/\s+/).length <= 7 &&
          !/[.,;:!?]$/.test(line) &&
          notesHeadingRe.test(line));

      if (looksHeading) {
        commit();
        currentHeading = line;
        continue;
      }

      // Normal paragraph line — append to the current section.
      currentParas.push(line);
    }
    commit();
    return { title, metaLines, sections };
  }

  function parseTranscriptBlock(lines: string[], fallbackTitle: string): ParsedTranscript {
    let title = fallbackTitle;
    let timecode: string | null = null;
    const turns: Array<{ speaker: string; text: string }> = [];

    let i = 0;
    // Header: optional date, title, optional "00:00:00" timecode.
    while (i < lines.length) {
      const line = lines[i];
      if (!line) { i++; continue; }
      if (/^\d{2}:\d{2}:\d{2}$/.test(line)) { timecode = line; i++; break; }
      if (!title && /Transcript$/.test(line)) { title = line; i++; continue; }
      if (!title) { title = line; i++; continue; }
      // After we have a title, anything that ISN'T a speaker / timestamp ends header.
      if (inlineSpeakerRe.test(line) || isSpeakerOnlyLine(line)) break;
      i++;
    }

    let pendingSpeaker = '';
    let pendingText = '';
    function pushPending() {
      if (pendingSpeaker && pendingText.trim()) {
        turns.push({ speaker: pendingSpeaker, text: pendingText.trim() });
      }
      pendingSpeaker = '';
      pendingText = '';
    }

    for (; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      // New timecode in the middle of the transcript → just an additional anchor;
      // we ignore it but treat it as a paragraph break.
      if (/^\d{2}:\d{2}:\d{2}$/.test(line)) {
        pushPending();
        continue;
      }
      const m = line.match(inlineSpeakerRe);
      if (m) {
        pushPending();
        pendingSpeaker = m[1].trim();
        pendingText = m[2];
        continue;
      }
      if (isSpeakerOnlyLine(line)) {
        // Look ahead: if the next non-empty line is also a speaker-only
        // line we're probably wrong (e.g. a 1-word paragraph). Push current
        // and start a new speaker context.
        pushPending();
        pendingSpeaker = line;
        pendingText = '';
        continue;
      }
      // Append to the current speaker's text.
      pendingText += (pendingText ? ' ' : '') + line;
    }
    pushPending();

    return { title, timecode, turns };
  }


  // Transcript-collapse state: keep transcripts collapsed by default at root,
  // expanded by default when nested deep (because user already drilled in).
  let transcriptOpen = depth > 0;
  function toggleTranscript() {
    transcriptOpen = !transcriptOpen;
  }
</script>

{#if isNullish}
  <span class="fields-viewer__nullish" title="No value set">—</span>

{:else if looksLikeTranscript}
  {@const doc = parseGeminiDoc(value as string)}
  {@const turnCount = doc.transcript?.turns.length ?? 0}
  <div class="gemini-doc">
    <button
      type="button"
      class="gemini-doc__toggle"
      class:gemini-doc__toggle--open={transcriptOpen}
      on:click={toggleTranscript}
      title={transcriptOpen ? 'Collapse meeting doc' : 'Expand meeting doc'}
    >
      <span class="gemini-doc__caret">{transcriptOpen ? '▾' : '▸'}</span>
      <span class="gemini-doc__title">📞 Meeting transcript &amp; notes</span>
      <span class="gemini-doc__stats">
        {#if doc.notes}{doc.notes.sections.length} sections{/if}
        {#if doc.notes && turnCount > 0} · {/if}
        {#if turnCount > 0}{turnCount} turns{/if}
        · {(value as string).length.toLocaleString()} chars
      </span>
    </button>

    {#if transcriptOpen}
      {#if doc.preface.length > 0}
        <p class="gemini-doc__preface">{doc.preface.join(' · ')}</p>
      {/if}

      <!-- ── 📝 Notes block (Gemini's structured summary) ─────────── -->
      {#if doc.notes}
        <section class="gemini-doc__section gemini-doc__section--notes">
          <header class="gemini-doc__section-header">
            <span class="gemini-doc__section-icon">📝</span>
            <span class="gemini-doc__section-name">Notes</span>
            {#if doc.notes.title}
              <span class="gemini-doc__section-subtitle">{doc.notes.title}</span>
            {/if}
          </header>

          {#if doc.notes.metaLines.length > 0}
            <ul class="gemini-doc__meta">
              {#each doc.notes.metaLines as m}
                <li class="gemini-doc__meta-item">{m}</li>
              {/each}
            </ul>
          {/if}

          <div class="gemini-doc__sections">
            {#each doc.notes.sections as sec, idx (idx)}
              {#if sec.heading || sec.paragraphs.length > 0 || sec.bullets.length > 0}
                <article class="gemini-doc__subsection">
                  {#if sec.heading}
                    <h4 class="gemini-doc__subsection-heading">{sec.heading}</h4>
                  {/if}
                  {#each sec.paragraphs as para}
                    <p class="gemini-doc__paragraph">{para}</p>
                  {/each}
                  {#if sec.bullets.length > 0}
                    <ul class="gemini-doc__bullets">
                      {#each sec.bullets as b}
                        <li>{b}</li>
                      {/each}
                    </ul>
                  {/if}
                </article>
              {/if}
            {/each}
          </div>
        </section>
      {/if}

      <!-- ── 📖 Transcript block (chat-bubble timeline) ──────────── -->
      {#if doc.transcript && turnCount > 0}
        <section class="gemini-doc__section gemini-doc__section--transcript">
          <header class="gemini-doc__section-header">
            <span class="gemini-doc__section-icon">📖</span>
            <span class="gemini-doc__section-name">Transcript</span>
            {#if doc.transcript.timecode}
              <span class="gemini-doc__timecode">{doc.transcript.timecode}</span>
            {/if}
            <span class="gemini-doc__section-subtitle">{turnCount} turns</span>
          </header>
          <ol class="gemini-doc__turns">
            {#each doc.transcript.turns as turn, i (i)}
              <li
                class="gemini-doc__turn"
                class:gemini-doc__turn--agent={/pablo|luis|agent|advisor|host|irp/i.test(turn.speaker)}
              >
                <span class="gemini-doc__turn-speaker">{turn.speaker}</span>
                <span class="gemini-doc__turn-text">{turn.text}</span>
              </li>
            {/each}
          </ol>
        </section>
      {/if}

      {#if doc.footer.length > 0}
        <p class="gemini-doc__footer">{doc.footer.join(' ')}</p>
      {/if}
    {/if}
  </div>

{:else if looksLikeIsoDate}
  <span class="fields-viewer__chip fields-viewer__chip--time" title={exactTime(value as string)}>
    <span class="fields-viewer__chip-icon">🕒</span>
    <span class="fields-viewer__chip-text">{relativeTime(value as string)}</span>
    <span class="fields-viewer__chip-sub">· {exactTime(value as string)}</span>
  </span>

{:else if looksLikeUrl}
  <a
    class="fields-viewer__chip fields-viewer__chip--link"
    href={value as string}
    target="_blank"
    rel="noopener noreferrer"
    title={value as string}
  >
    <span class="fields-viewer__chip-icon">🔗</span>
    <span class="fields-viewer__chip-text">
      {#if /meet\.google\.com/.test(value as string)}
        Open Google Meet
      {:else if /calendar\.google\.com/.test(value as string)}
        Open in Calendar
      {:else}
        {(value as string).replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}
      {/if}
    </span>
  </a>

{:else if looksLikeEmail}
  <a class="fields-viewer__chip fields-viewer__chip--email" href={`mailto:${value}`} title={value as string}>
    <span class="fields-viewer__chip-icon">✉️</span>
    <span class="fields-viewer__chip-text">{value}</span>
  </a>

{:else if looksLikePhone && leafKey.toLowerCase().includes('phone')}
  <a class="fields-viewer__chip fields-viewer__chip--phone" href={`tel:${value}`} title={value as string}>
    <span class="fields-viewer__chip-icon">📞</span>
    <span class="fields-viewer__chip-text">{value}</span>
  </a>

{:else if looksLikeMonoToken}
  <code class="fields-viewer__token" title={value as string}>{(value as string).slice(0, 24)}{(value as string).length > 24 ? '…' : ''}</code>

{:else if isPrimitive}
  <EditableField
    {clientId}
    {path}
    {value}
    label={resolvedLabel}
    multiline={isLongString || hasNewlines}
    {readonly}
  />

{:else if isArrayOfPrimitives}
  <div class="fields-viewer__pill-row">
    {#each (value as unknown[]) as item, i (i)}
      <span class="fields-viewer__pill" title={String(item)}>
        {#if typeof item === 'boolean'}
          <span class="fields-viewer__pill-bool">{item ? '✓' : '✗'}</span>
        {/if}
        {String(item)}
      </span>
    {/each}
    {#if (value as unknown[]).length === 0}
      <span class="fields-viewer__nullish">empty list</span>
    {/if}
  </div>

{:else if isArray}
  <div class="fields-viewer__array">
    {#each (value as unknown[]) as item, i (i)}
      <details class="fields-viewer__array-item" open={i === 0 && depth === 0}>
        <summary class="fields-viewer__array-item-summary">
          <span class="fields-viewer__array-index">#{i + 1}</span>
          <span class="fields-viewer__array-preview">
            {#if item && typeof item === 'object' && !Array.isArray(item)}
              {Object.keys(item as object).slice(0, 4).join(' · ')}
            {:else}
              {String(item).slice(0, 80)}
            {/if}
          </span>
          <span class="fields-viewer__array-chevron">▸</span>
        </summary>
        <div class="fields-viewer__array-body">
          <svelte:self
            {clientId}
            path={`${path}.${i}`}
            value={item}
            depth={depth + 1}
            {readonly}
          />
        </div>
      </details>
    {/each}
    {#if (value as unknown[]).length === 0}
      <span class="fields-viewer__nullish">empty list</span>
    {/if}
  </div>

{:else if isObject}
  <div class="fields-viewer__object" class:fields-viewer__object--nested={depth > 0}>
    {#each objectEntries(value) as [k, v] (k)}
      <div class="fields-viewer__row">
        <span class="fields-viewer__row-key">{humanizeFieldLabel(k)}</span>
        <div class="fields-viewer__row-value">
          <svelte:self
            {clientId}
            path={`${path}.${k}`}
            value={v}
            depth={depth + 1}
            {readonly}
          />
        </div>
      </div>
    {/each}
  </div>

{:else}
  <!-- Truly unknown shape (function/symbol/etc) — render the type for honesty. -->
  <span class="fields-viewer__nullish">[{typeof value}]</span>
{/if}
