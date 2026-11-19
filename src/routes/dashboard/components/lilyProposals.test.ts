/**
 * Lily's confirmation panel — the deterministic half of "Lily proposes, staff
 * confirms". Lily never decides what gets written; these functions do.
 */
import { describe, it, expect } from 'vitest';
import {
  collectPendingRows,
  clearedValue,
  conflictValue,
  receiptHeadline,
  typeOf,
  undoPlan,
  type ReceiptItem,
  draftOf,
  messageProposalSummary,
  parseDraft,
  readPath,
  sameValue,
  type FieldProposal,
} from './lilyProposals.ts';

const proposal = (over: Partial<FieldProposal>): FieldProposal => ({
  id: 'fp-1',
  key: 'name',
  label: 'First Name',
  path: 'consultations.0.name',
  op: 'set',
  valueType: 'string',
  oldValue: 'test',
  newValue: 'Adelle',
  status: 'pending',
  ...over,
});

describe('collectPendingRows', () => {
  // Regression: the same "First Name test → Adelle" proposal arrived three
  // times and showed three separate cards.
  it('shows one row per field, newest proposal wins, older ones hidden behind it', () => {
    const rows = collectPendingRows([
      { fieldProposals: [proposal({ id: 'a' })] },
      {},
      { fieldProposals: [proposal({ id: 'b' })] },
      { fieldProposals: [proposal({ id: 'c', newValue: 'Adele' }), proposal({ id: 'd', key: 'phone', path: 'consultations.0.phone', newValue: '1' })] },
    ]);
    expect(rows.map((r) => [r.proposal.id, r.hiddenIds])).toEqual([
      ['c', ['a', 'b']],
      ['d', []],
    ]);
  });

  it('ignores resolved proposals', () => {
    const rows = collectPendingRows([
      { fieldProposals: [proposal({ id: 'a', status: 'applied' }), proposal({ id: 'b', status: 'superseded' }), proposal({ id: 'c', status: 'rejected' })] },
    ]);
    expect(rows).toEqual([]);
  });
});

describe('parseDraft', () => {
  it('uses the edited text for string fields', () => {
    expect(parseDraft(proposal({}), '  Adelle Smith ')).toEqual({ ok: true, value: 'Adelle Smith' });
    expect(parseDraft(proposal({}), '   ').ok).toBe(false);
  });

  it('treats proposals stored before op/valueType existed as string sets', () => {
    const legacy = proposal({ op: undefined, valueType: undefined });
    expect(parseDraft(legacy, 'Adelle')).toEqual({ ok: true, value: 'Adelle' });
  });

  it('validates numbers, booleans, enums and dates', () => {
    expect(parseDraft(proposal({ valueType: 'number' }), '1,200')).toEqual({ ok: true, value: 1200 });
    expect(parseDraft(proposal({ valueType: 'number' }), 'abc').ok).toBe(false);
    expect(parseDraft(proposal({ valueType: 'boolean' }), 'false')).toEqual({ ok: true, value: false });
    expect(parseDraft(proposal({ valueType: 'boolean' }), 'maybe').ok).toBe(false);
    const en = proposal({ valueType: 'enum', options: ['single', 'double'] });
    expect(parseDraft(en, 'double')).toEqual({ ok: true, value: 'double' });
    expect(parseDraft(en, 'triple').ok).toBe(false);
    expect(parseDraft(proposal({ valueType: 'date' }), '2027-01-15')).toEqual({ ok: true, value: '2027-01-15' });
    expect(parseDraft(proposal({ valueType: 'date' }), 'next week').ok).toBe(false);
  });

  it('a clear writes the empty value for the field type, whatever was typed', () => {
    expect(parseDraft(proposal({ op: 'clear', newValue: null }), 'x')).toEqual({ ok: true, value: '' });
    expect(clearedValue(proposal({ valueType: 'number' }))).toBe(null);
    expect(clearedValue(proposal({ valueType: 'boolean' }))).toBe(null);
    expect(draftOf(proposal({ op: 'clear', newValue: null }))).toBe('');
  });
});

describe('helpers', () => {
  it('sameValue treats empties as equal and compares trimmed text', () => {
    expect(sameValue(null, '')).toBe(true);
    expect(sameValue('Adelle', ' Adelle ')).toBe(true);
    expect(sameValue('test', 'Adelle')).toBe(false);
    expect(sameValue('', 'Adelle')).toBe(false);
  });

  it('readPath follows dotted paths into arrays', () => {
    const doc = { consultations: [{ name: 'a' }, { name: 'b' }], customFields: { pets: '2' } };
    expect(readPath(doc, 'consultations.1.name')).toBe('b');
    expect(readPath(doc, 'customFields.pets')).toBe('2');
    expect(readPath(doc, 'missing.deep.path')).toBe(undefined);
  });

  it('summarizes the proposals of one message', () => {
    expect(messageProposalSummary([proposal({}), proposal({ id: 'x', status: 'applied' })])).toBe(
      'Proposed 2 changes: 1 waiting in the panel below, 1 saved',
    );
    expect(messageProposalSummary([proposal({ status: 'superseded' })])).toBe('Proposed 1 change: 1 replaced');
  });
});

describe('backward compatibility', () => {
  it('infers the editor type of legacy proposals from their value', () => {
    expect(typeOf(proposal({ valueType: undefined, newValue: 3 }))).toBe('number');
    expect(typeOf(proposal({ valueType: undefined, newValue: true }))).toBe('boolean');
    expect(typeOf(proposal({ valueType: undefined }))).toBe('string');
    expect(parseDraft(proposal({ valueType: undefined, op: undefined, newValue: 3 }), '4')).toEqual({ ok: true, value: 4 });
  });

  it('messages without proposals and empty threads are fine', () => {
    expect(collectPendingRows([])).toEqual([]);
    expect(collectPendingRows([{}, { fieldProposals: [] }])).toEqual([]);
    expect(messageProposalSummary([])).toBe('');
  });
});

describe('robustness', () => {
  it('reads the server value out of a 409 conflict only', () => {
    expect(conflictValue({ status: 409, data: { currentValue: 'Ana' } })).toEqual({ current: 'Ana' });
    expect(conflictValue({ status: 409, data: {} })).toEqual({ current: null });
    expect(conflictValue({ status: 500 })).toBe(null);
    expect(conflictValue(new Error('x'))).toBe(null);
    expect(conflictValue(null)).toBe(null);
  });

  it('summarizes an apply and plans undo newest-first, saved writes only', () => {
    const item = (id: string, outcome: ReceiptItem['outcome']): ReceiptItem => ({ id, label: id, path: id, outcome, before: 'b', after: 'a' });
    const items = [item('1', 'saved'), item('2', 'skipped'), item('3', 'saved'), item('4', 'failed'), item('5', 'unchanged')];
    expect(receiptHeadline(items)).toBe('Saved 2 · 1 already set · Skipped 1 · 1 not saved');
    expect(undoPlan(items).map((i) => i.id)).toEqual(['3', '1']);
    expect(receiptHeadline([])).toBe('Nothing changed');
  });
});
