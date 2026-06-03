// Pure decision logic for cleaning up abandoned "pending" bookings.
// Extracted from /api/booking/checkout so it can be regression-tested
// without hitting Stripe or Supabase.
//
// Safety invariants (each one is a separate incident this guards against):
//   1. Never delete a booking that Stripe has marked paid — self-heal instead.
//      (2026-04: a paid $100 booking was deleted because the webhook hadn't
//      fired yet, so the row looked "unpaid".)
//   2. Never delete on missing/ambiguous evidence. The default is KEEP. We
//      only delete when Stripe positively tells us the session is finished
//      and unpaid (status === "expired"). A session that is still "open"
//      means the customer may yet pay, so we leave the row alone.

export interface StripeSessionLike {
  // "complete" once paid, "open" while awaiting payment, "expired" once closed.
  status?: string | null;
  payment_status: string | null;
  payment_intent: string | { id: string } | null | undefined;
}

export type CleanupDecision =
  | { action: "heal"; paymentIntentId: string }
  | { action: "delete" }
  | { action: "keep" };

// `session` is the result of retrieving the booking's Checkout Session by id
// (or null if no session id is stored / the retrieve failed). Decisions are
// made on a single authoritative session, not a search — searches lag and
// can wrongly report "no paid session" for a booking that was just paid.
export function decideCleanupAction(
  session: StripeSessionLike | null | undefined
): CleanupDecision {
  // No evidence at all (legacy row without a session id, or a failed retrieve).
  // Never delete on absence of evidence.
  if (!session) return { action: "keep" };

  // Paid -> self-heal regardless of the session's lifecycle status.
  if (session.payment_status === "paid") {
    const pi = session.payment_intent;
    const paymentIntentId =
      typeof pi === "string" ? pi : pi && typeof pi === "object" ? pi.id : "";
    // Paid but the payment intent isn't attached yet -> keep and wait; don't
    // delete a paid booking just because we can't read its PI id this instant.
    if (!paymentIntentId) return { action: "keep" };
    return { action: "heal", paymentIntentId };
  }

  // Positively finished and unpaid -> safe to delete. Stripe expires a
  // Checkout Session once it can no longer be paid (default 24h, or sooner).
  if (session.status === "expired") return { action: "delete" };

  // Unpaid but still open (or any other non-terminal state) -> the customer
  // may still complete payment. Leave the booking in place.
  return { action: "keep" };
}
