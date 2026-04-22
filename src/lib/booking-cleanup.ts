// Pure decision logic for cleaning up abandoned "pending" bookings.
// Extracted from /api/booking/checkout so it can be regression-tested
// without hitting Stripe or Supabase. The underlying bug this guards
// against: previously, cleanup deleted rows based purely on
// "stripe_payment_intent_id IS NULL", which wiped paid bookings when
// the Stripe webhook hadn't yet fired.

export interface StripeSessionLike {
  payment_status: string | null;
  payment_intent: string | { id: string } | null | undefined;
}

export type CleanupDecision =
  | { action: "heal"; paymentIntentId: string }
  | { action: "delete" };

export function decideCleanupAction(
  sessions: StripeSessionLike[]
): CleanupDecision {
  const paid = sessions.find(
    (s) => s.payment_status === "paid" && s.payment_intent
  );
  if (!paid) return { action: "delete" };

  const pi = paid.payment_intent;
  const paymentIntentId =
    typeof pi === "string" ? pi : pi && typeof pi === "object" ? pi.id : "";
  if (!paymentIntentId) return { action: "delete" };

  return { action: "heal", paymentIntentId };
}
