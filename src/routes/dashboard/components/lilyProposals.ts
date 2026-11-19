/**
 * lilyProposals.ts — deterministic logic behind Lily's confirmation panel.
 *
 * Lily (the model) only PROPOSES field changes. Everything after that is plain
 * code in this file and in CrmLilyTab: which proposals are shown, how a staff
 * edit is parsed and validated, and what value is written. The panel then
 * writes through the same `editField` store action as a manual edit.
 *
 * Kept free of Svelte so it can be unit-tested (lilyProposals.test.ts).
 */

export type ProposalValueType = 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'enum';
export type ProposalOp = 'set' | 'clear';
export type ProposalStatus = 'pending' | 'applied' | 'rejected' | 'superseded';
export type ProposalValue = string | number | boolean | null;

/** Mirrors LilyFieldProposal in irp-funnel-server/services/lily/lilyFieldProposals.ts. */
export type FieldProposal = {
  id: string;
  key: string;
  label: string;
  path: string;
  /** Absent on proposals stored before clear existed: treat as 'set'. */
  op?: ProposalOp;
  /** Absent on older proposals: treat as 'string'. */
  valueType?: ProposalValueType;
  options?: string[];
  oldValue: unknown;
  newValue: ProposalValue;
  status: ProposalStatus;
  appliedValue?: ProposalValue;
};

export type ProposalRow = {
  proposal: FieldProposal;
  /** Older pending proposals for the same field, hidden behind this row. */
  hiddenIds: string[];
};

/** What staff decided for one panel row when they pressed Apply. */
export type Decision = {
  row: ProposalRow;
  include: boolean;
  /** Value to write when include is true. */
  value: ProposalValue;
  /** Value on the record right now (what the write replaces). */
  current: unknown;
};

export function opOf(p: FieldProposal): ProposalOp {
  return p.op ?? 'set';
}

/**
 * The editor type. Proposals stored before valueType existed carry only their
 * value, so the type is inferred from it — the server does the same
 * (effectiveValueType in lilyFieldProposals.ts), so both agree on valid edits.
 */
export function typeOf(p: FieldProposal): ProposalValueType {
  if (p.valueType) return p.valueType;
  if (typeof p.newValue === 'number') return 'number';
  if (typeof p.newValue === 'boolean') return 'boolean';
  return 'string';
}

export function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

/**
 * Every pending proposal across the thread, one row per field. The newest
 * proposal for a field wins; older pending ones for the same field are kept
 * as `hiddenIds` so resolving the row resolves them too. (The server already
 * retires replaced proposals; this also covers threads stored before it did.)
 * Rows are ordered by when their field was first proposed.
 */
export function collectPendingRows(messages: Array<{ fieldProposals?: FieldProposal[] }>): ProposalRow[] {
  const byPath = new Map<string, ProposalRow>();
  for (const m of messages) {
    for (const p of m.fieldProposals ?? []) {
      if (p.status !== 'pending') continue;
      const existing = byPath.get(p.path);
      if (existing) {
        existing.hiddenIds.push(existing.proposal.id);
        existing.proposal = p;
      } else {
        byPath.set(p.path, { proposal: p, hiddenIds: [] });
      }
    }
  }
  return [...byPath.values()];
}

/** Text for the editor's initial value. */
export function draftOf(p: FieldProposal): string {
  if (opOf(p) === 'clear' || p.newValue === null) return '';
  return String(p.newValue);
}

/** What "empty" means when a field is cleared: '' for text-like fields, null otherwise. */
export function clearedValue(p: FieldProposal): ProposalValue {
  const t = typeOf(p);
  return t === 'number' || t === 'boolean' ? null : '';
}

export type ParsedDraft = { ok: true; value: ProposalValue } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turn what staff typed into the value to write, or explain why it can't be
 * written. A clear proposal always writes the field's empty value.
 */
export function parseDraft(p: FieldProposal, draft: string): ParsedDraft {
  if (opOf(p) === 'clear') return { ok: true, value: clearedValue(p) };
  const s = draft.trim();
  const t = typeOf(p);
  if (t === 'boolean') {
    if (s === 'true') return { ok: true, value: true };
    if (s === 'false') return { ok: true, value: false };
    return { ok: false, error: 'Choose Yes or No.' };
  }
  if (!s) return { ok: false, error: 'Enter a value, or turn this change off.' };
  if (t === 'number') {
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: 'Enter a number.' };
  }
  if (t === 'enum' && p.options?.length) {
    return p.options.includes(s) ? { ok: true, value: s } : { ok: false, error: 'Pick one of the listed options.' };
  }
  if (t === 'date' && !DATE_RE.test(s)) return { ok: false, error: 'Use the format YYYY-MM-DD.' };
  return { ok: true, value: s };
}

/** True when writing `next` would not change `current`. */
export function sameValue(current: unknown, next: ProposalValue): boolean {
  if (isEmptyValue(current) && isEmptyValue(next)) return true;
  if (isEmptyValue(current) || isEmptyValue(next)) return false;
  return String(current).trim() === String(next).trim();
}

/** Read a dotted path such as "consultations.1.name" from the client document. */
export function readPath(doc: unknown, path: string): unknown {
  let cur: any = doc;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function formatValue(v: unknown): string {
  if (isEmptyValue(v)) return 'Empty';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/** Short status line for the proposals attached to one chat message. */
export function messageProposalSummary(list: FieldProposal[]): string {
  if (!list.length) return '';
  const count = (s: ProposalStatus) => list.filter((p) => p.status === s).length;
  const parts: string[] = [];
  const pending = count('pending');
  if (pending) parts.push(`${pending} waiting in the panel below`);
  if (count('applied')) parts.push(`${count('applied')} saved`);
  if (count('rejected')) parts.push(`${count('rejected')} skipped`);
  if (count('superseded')) parts.push(`${count('superseded')} replaced`);
  const noun = list.length === 1 ? 'change' : 'changes';
  return `Proposed ${list.length} ${noun}: ${parts.join(', ')}`;
}

/**
 * When a save failed because the field changed after it was read (HTTP 409),
 * the server sends the value it holds now. Returns it so the panel can show
 * the real current value and the next Apply compares against it.
 */
export function conflictValue(err: unknown): { current: unknown } | null {
  const e = err as { status?: number; data?: { currentValue?: unknown } } | null;
  if (e?.status !== 409) return null;
  return { current: e.data?.currentValue ?? null };
}

export type ReceiptOutcome = 'saved' | 'unchanged' | 'skipped' | 'failed';

/** One line of what happened when staff pressed Apply. */
export type ReceiptItem = {
  id: string;
  label: string;
  path: string;
  outcome: ReceiptOutcome;
  /** Value before the write (for Undo). */
  before: unknown;
  /** Value written. */
  after: ProposalValue;
};

export type Receipt = {
  items: ReceiptItem[];
  /** 'idle' until Undo is pressed. */
  undo: 'idle' | 'working' | 'done' | 'failed';
  undoError?: string;
};

/** "Saved 2 · Skipped 1" — only the outcomes that happened. */
export function receiptHeadline(items: ReceiptItem[]): string {
  const n = (o: ReceiptOutcome) => items.filter((i) => i.outcome === o).length;
  const parts: string[] = [];
  if (n('saved')) parts.push(`Saved ${n('saved')}`);
  if (n('unchanged')) parts.push(`${n('unchanged')} already set`);
  if (n('skipped')) parts.push(`Skipped ${n('skipped')}`);
  if (n('failed')) parts.push(`${n('failed')} not saved`);
  return parts.join(' · ') || 'Nothing changed';
}

/** Saved items, newest write first: the order Undo must revert them in. */
export function undoPlan(items: ReceiptItem[]): ReceiptItem[] {
  return items.filter((i) => i.outcome === 'saved').reverse();
}
