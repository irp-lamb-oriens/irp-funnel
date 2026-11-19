import { describe, expect, it } from 'vitest';
import { agreedServices, chosenOptions, isAcceptedQuote, optionCount, optionsLabel, quoteValue } from './quoteValue.ts';

const g = (groupId: string, role: string) => ({ groupId, role, title: groupId, lineItems: [] });

const threeMoves = {
  status: 'sent_to_client',
  total: 12_600,
  lineGroups: [g('fee', 'fixed'), g('lcl', 'required'), g('20ft', 'required'), g('40ft', 'required'), g('ins', 'optional')],
};

describe('quoteValue', () => {
  it('an open quote with options has no single value, only a count', () => {
    expect(optionCount(threeMoves)).toBe(4);
    expect(optionsLabel(optionCount(threeMoves))).toBe('4 options');
    expect(quoteValue(threeMoves)).toBeNull();
  });

  it('an accepted quote is worth what the client chose, not every option summed', () => {
    const accepted = { ...threeMoves, status: 'client_accepted', finalBilledTotal: 3_100 };
    expect(isAcceptedQuote(accepted)).toBe(true);
    expect(quoteValue(accepted)).toBe(3_100);
  });

  it('a single package with no add-ons is a plain quote', () => {
    const one = { status: 'sent_to_client', total: 4_100, lineGroups: [g('fee', 'fixed'), g('lcl', 'required')] };
    expect(optionCount(one)).toBe(0);
    expect(quoteValue(one)).toBe(4_100);
  });

  it('a flat legacy quote is untouched', () => {
    expect(quoteValue({ status: 'draft', total: 900 })).toBe(900);
    expect(optionsLabel(0)).toBe('');
  });

  it('trusts an option count already resolved by the server', () => {
    expect(quoteValue({ status: 'sent_to_client', total: null, optionCount: 3 })).toBeNull();
    expect(optionCount({ optionCount: 3 })).toBe(3);
  });
});

// Two options sent to the client ($10,000 and $13,000) plus a $500 fee; the
// client accepted the $13,000 one. Mirrors the server's acceptedQuote tests.
describe('accepted quotes are fixed', () => {
  const groups = [
    { groupId: 'g-a', title: 'Option A', role: 'required', lineItems: [] },
    { groupId: 'g-b', title: 'Option B', role: 'required', lineItems: [] },
    { groupId: 'g-fee', title: 'Admin fee', role: 'fixed', lineItems: [] },
  ];
  const acceptedB = {
    status: 'client_accepted',
    clientAcceptedAt: '2026-11-10T15:00:00Z',
    total: 23_500,
    finalBilledTotal: 13_500,
    lineGroups: groups,
    selectedGroupIds: ['g-b', 'g-fee'],
    contractSnapshot: {
      services: [
        { id: 'g-fee', title: 'Admin fee', description: null, price: 500, role: 'fixed' },
        { id: 'g-b', title: 'Option B', description: 'Full service', price: 13_000, role: 'required' },
      ],
    },
  };

  it('bills the services the client signed', () => {
    expect(agreedServices(acceptedB)?.map((s) => [s.id, s.price])).toEqual([['g-fee', 500], ['g-b', 13_000]]);
  });

  it('names the option the client chose, with or without a snapshot', () => {
    expect(chosenOptions(acceptedB)).toEqual(['Option B']);
    expect(chosenOptions({ ...acceptedB, contractSnapshot: null })).toEqual(['Option B']);
  });

  it('a quote reset to draft after acceptance is still accepted', () => {
    expect(isAcceptedQuote({ ...acceptedB, status: 'draft' })).toBe(true);
    expect(chosenOptions({ ...acceptedB, status: 'draft' })).toEqual(['Option B']);
  });

  it('ignores a snapshot that disagrees with the agreed total, and open quotes', () => {
    expect(agreedServices({ ...acceptedB, finalBilledTotal: 10_500 })).toBeNull();
    expect(agreedServices({ ...acceptedB, status: 'sent_to_client', clientAcceptedAt: null })).toBeNull();
    expect(chosenOptions({ ...acceptedB, status: 'sent_to_client', clientAcceptedAt: null })).toEqual([]);
  });
});
