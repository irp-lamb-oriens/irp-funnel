import { describe, expect, it } from 'vitest';
import { isAcceptedQuote, optionCount, optionsLabel, quoteValue } from './quoteValue.ts';

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
