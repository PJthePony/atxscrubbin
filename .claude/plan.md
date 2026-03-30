# Tipping Feature — Implementation Plan

## Overview
Add tipping at two touchpoints:
1. **At booking time** — tip selector on the review step, included in the Stripe checkout
2. **After wash completion** — tip link in the "all done" SMS, opens a dedicated tip page with its own Stripe checkout

If the customer tips at booking, we skip the tip link in the completion SMS.

---

## Database Changes

**New migration** (`supabase/migrations/XXX_add_tipping.sql`):
- Add to `bookings` table:
  - `tip_amount DECIMAL(10,2) DEFAULT 0` — tip added at checkout
  - `tip_stripe_payment_intent_id TEXT` — payment intent for post-wash tips (separate charge)

---

## Part 1: Tipping at Checkout (Review Step)

### Frontend — `src/app/book/page.tsx`
- Add tip selector UI between the order summary and the "Pay & Confirm" button on the review step
- Options: **No tip**, **$5**, **$10**, **$15**, **Custom**
- New state: `tipAmount` (default 0)
- Update the displayed total to include tip: `total + tipAmount`
- Pass `tip_amount` in the POST to `/api/booking/checkout`

### Backend — `src/app/api/booking/checkout/route.ts`
- Accept `tip_amount` from the request body
- If `tip_amount > 0`, add a "Tip" line item to the Stripe checkout session
- Save `tip_amount` on the booking record in Supabase

### Webhook — `src/app/api/stripe/webhook/route.ts`
- No changes needed — the tip is just part of the same checkout session

---

## Part 2: Tipping After Completion (SMS Link)

### New Page — `src/app/tip/[id]/page.tsx`
- Public page (no auth required) — accessed via SMS link
- Fetches booking details via a new API route
- Shows: "Thanks for choosing ATX Scrubbin'!" with the booking summary
- Tip selector: **$5**, **$10**, **$15**, **Custom**
- "Send Tip" button → calls new API to create a Stripe checkout session
- Redirects to Stripe checkout, then back to a thank-you state on the same page
- If booking already has a tip (either from checkout or post-wash), shows "You already tipped — thank you!" instead

### New API — `src/app/api/tip/route.ts`
- `GET ?booking_id=X` — returns booking summary (customer name, service, date, existing tip status). Validates booking exists and is completed.
- `POST` — accepts `{ booking_id, tip_amount }`, creates a Stripe checkout session for just the tip amount, returns the session URL
  - Success URL: `/tip/{booking_id}?thanks=true`
  - Metadata: `{ booking_id, type: "tip" }`

### Webhook Update — `src/app/api/stripe/webhook/route.ts`
- Handle tip checkout completions: when `metadata.type === "tip"`, update the booking's `tip_amount` and `tip_stripe_payment_intent_id`

### SMS Update — `src/lib/twilio.ts` + admin bookings PATCH
- Update `completionText` to include a tip link: `/tip/{bookingId}`
- Only include the tip link if `booking.tip_amount === 0` (no tip at checkout)
- Need the app's base URL — use `NEXT_PUBLIC_BASE_URL` env var (or fall back to a default)

---

## Part 3: Types Update

### `src/types/index.ts`
- Add `tip_amount` and `tip_stripe_payment_intent_id` to the `Booking` interface

---

## Part 4: Admin Visibility

### Admin bookings display
- Show tip amount in booking details (if > 0)
- Show total collected = booking total + tip

---

## File Summary

| File | Change |
|------|--------|
| `supabase/migrations/XXX_add_tipping.sql` | New: add tip columns |
| `src/types/index.ts` | Add tip fields to Booking |
| `src/app/book/page.tsx` | Add tip selector to review step |
| `src/app/api/booking/checkout/route.ts` | Accept tip, add line item |
| `src/app/tip/[id]/page.tsx` | New: post-wash tip page |
| `src/app/api/tip/route.ts` | New: GET booking info + POST create tip session |
| `src/app/api/stripe/webhook/route.ts` | Handle tip checkout completion |
| `src/lib/twilio.ts` | Update completion SMS with tip link |
| `src/app/api/admin/bookings/route.ts` | Include tip link logic in completion SMS |
| Admin UI (if applicable) | Show tip amount in booking details |
