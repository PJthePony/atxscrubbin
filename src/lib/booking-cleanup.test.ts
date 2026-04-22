import { describe, it, expect } from "vitest";
import { decideCleanupAction, StripeSessionLike } from "./booking-cleanup";

// These tests protect the invariant that "cleanup" NEVER deletes a booking
// for which Stripe already has a paid Checkout session. The original bug
// deleted paid bookings whenever the webhook hadn't fired yet.

describe("decideCleanupAction", () => {
  it("deletes when there are no Stripe sessions at all", () => {
    expect(decideCleanupAction([])).toEqual({ action: "delete" });
  });

  it("deletes when sessions exist but none are paid", () => {
    const sessions: StripeSessionLike[] = [
      { payment_status: "unpaid", payment_intent: null },
      { payment_status: "no_payment_required", payment_intent: null },
    ];
    expect(decideCleanupAction(sessions)).toEqual({ action: "delete" });
  });

  it("HEALS instead of deleting when a paid session exists (string payment_intent)", () => {
    const sessions: StripeSessionLike[] = [
      { payment_status: "paid", payment_intent: "pi_abc123" },
    ];
    expect(decideCleanupAction(sessions)).toEqual({
      action: "heal",
      paymentIntentId: "pi_abc123",
    });
  });

  it("HEALS when payment_intent is an expanded object", () => {
    const sessions: StripeSessionLike[] = [
      { payment_status: "paid", payment_intent: { id: "pi_expanded" } },
    ];
    expect(decideCleanupAction(sessions)).toEqual({
      action: "heal",
      paymentIntentId: "pi_expanded",
    });
  });

  it("HEALS when multiple sessions exist and at least one is paid", () => {
    const sessions: StripeSessionLike[] = [
      { payment_status: "unpaid", payment_intent: null },
      { payment_status: "paid", payment_intent: "pi_winner" },
      { payment_status: "expired", payment_intent: null },
    ];
    expect(decideCleanupAction(sessions)).toEqual({
      action: "heal",
      paymentIntentId: "pi_winner",
    });
  });

  it("falls back to delete when paid session has no payment_intent (degenerate)", () => {
    const sessions: StripeSessionLike[] = [
      { payment_status: "paid", payment_intent: null },
    ];
    expect(decideCleanupAction(sessions)).toEqual({ action: "delete" });
  });
});
