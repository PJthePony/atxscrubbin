import { describe, it, expect } from "vitest";
import { decideCleanupAction, StripeSessionLike } from "./booking-cleanup";

// These tests protect the invariant that "cleanup" NEVER deletes a booking
// for which Stripe has a paid Checkout session, and never deletes on missing
// or ambiguous evidence. The original bug deleted paid bookings whenever the
// webhook hadn't fired yet; the default must be KEEP.

describe("decideCleanupAction", () => {
  it("KEEPS when there is no session at all (null)", () => {
    expect(decideCleanupAction(null)).toEqual({ action: "keep" });
  });

  it("KEEPS when there is no session at all (undefined)", () => {
    expect(decideCleanupAction(undefined)).toEqual({ action: "keep" });
  });

  it("KEEPS an unpaid session that is still open (customer may yet pay)", () => {
    const session: StripeSessionLike = {
      status: "open",
      payment_status: "unpaid",
      payment_intent: null,
    };
    expect(decideCleanupAction(session)).toEqual({ action: "keep" });
  });

  it("DELETES an expired, unpaid session", () => {
    const session: StripeSessionLike = {
      status: "expired",
      payment_status: "unpaid",
      payment_intent: null,
    };
    expect(decideCleanupAction(session)).toEqual({ action: "delete" });
  });

  it("HEALS a paid session (string payment_intent)", () => {
    const session: StripeSessionLike = {
      status: "complete",
      payment_status: "paid",
      payment_intent: "pi_abc123",
    };
    expect(decideCleanupAction(session)).toEqual({
      action: "heal",
      paymentIntentId: "pi_abc123",
    });
  });

  it("HEALS when payment_intent is an expanded object", () => {
    const session: StripeSessionLike = {
      status: "complete",
      payment_status: "paid",
      payment_intent: { id: "pi_expanded" },
    };
    expect(decideCleanupAction(session)).toEqual({
      action: "heal",
      paymentIntentId: "pi_expanded",
    });
  });

  it("HEALS a paid session even if Stripe still reports status=open", () => {
    // Payment state is authoritative over lifecycle status; never delete a paid row.
    const session: StripeSessionLike = {
      status: "open",
      payment_status: "paid",
      payment_intent: "pi_race",
    };
    expect(decideCleanupAction(session)).toEqual({
      action: "heal",
      paymentIntentId: "pi_race",
    });
  });

  it("KEEPS (does not delete) a paid session whose payment_intent isn't attached yet", () => {
    const session: StripeSessionLike = {
      status: "complete",
      payment_status: "paid",
      payment_intent: null,
    };
    expect(decideCleanupAction(session)).toEqual({ action: "keep" });
  });
});
