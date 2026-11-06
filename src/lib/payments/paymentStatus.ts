/**
 * paymentStatus.ts — the one payment vocabulary, shared by the client page,
 * the client card and Finance (see the "Payments UX plan" doc, One vocabulary).
 *
 * Four statuses, each ALWAYS shown as a word + an icon + a color together:
 *   due       grey   empty circle   nothing has arrived yet
 *   on_its_way blue  clock          a bank payment was sent; up to 4 business days
 *   received  green  check          the money is in IRP's account
 *   problem   red    exclamation    didn't go through / disputed
 */

export type PayStatus = 'due' | 'on_its_way' | 'received' | 'problem';

export const PAY_STATUS: Record<PayStatus, { word: string; help: string }> = {
  due: { word: 'Due', help: 'Nothing has arrived yet.' },
  on_its_way: {
    word: 'On its way',
    help: 'A bank payment was sent and takes up to 4 business days to arrive. Nothing to do.',
  },
  received: { word: 'Received', help: "The money is in IRP's account." },
  problem: { word: "Didn't go through", help: 'Nothing was charged. Try again or use another way to pay.' },
};

/** Map a Stripe PaymentIntent status (as stored) to the shared vocabulary. */
export function statusOfPayment(stripeStatus: string | null | undefined, disputed = false): PayStatus {
  if (disputed) return 'problem';
  switch (stripeStatus) {
    case 'succeeded': return 'received';
    case 'processing': return 'on_its_way';
    case 'requires_payment_method':
    case 'canceled': return 'problem';
    default: return 'due';
  }
}

/** Map a schedule row status (paymentMath.ts) to the shared vocabulary. */
export function statusOfSegment(s: 'paid' | 'partial' | 'processing' | 'due'): PayStatus {
  return s === 'paid' ? 'received' : s === 'processing' ? 'on_its_way' : 'due';
}

/**
 * Plain-language payment errors: what happened, that nothing was charged, and
 * the one thing to do next. Stripe's field-level validation messages ("Your
 * card number is incomplete.") are already plain and stay as they are.
 */
export function friendlyPaymentError(err: { type?: string; code?: string; decline_code?: string; message?: string } | null | undefined): string {
  if (!err) return "The payment didn't go through. Nothing was charged. Please try again.";
  if (err.type === 'validation_error' && err.message) return err.message;
  const code = err.decline_code || err.code || '';
  switch (code) {
    case 'insufficient_funds':
      return "The card doesn't have enough available funds. Nothing was charged. Try another card or pay from your US bank account.";
    case 'expired_card':
      return 'This card has expired. Nothing was charged. Please use another card.';
    case 'incorrect_cvc':
    case 'invalid_cvc':
      return "The security code (the 3 or 4 digits on the card) doesn't match. Nothing was charged. Please check it and try again.";
    case 'incorrect_number':
    case 'invalid_number':
      return "The card number isn't right. Nothing was charged. Please check it and try again.";
    case 'processing_error':
      return 'Something went wrong at the bank. Nothing was charged. Please try again in a minute.';
    case 'authentication_required':
    case 'payment_intent_authentication_failure':
      return "Your bank's security check wasn't completed. Nothing was charged. Try again and finish the check your bank shows.";
    case 'card_declined':
    case 'generic_decline':
    case 'do_not_honor':
      return 'Your bank declined the card. Nothing was charged. Try another card or pay from your US bank account.';
    default:
      return "The payment didn't go through. Nothing was charged. Try again or choose another way to pay.";
  }
}
