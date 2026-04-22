import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Hourly health monitor. Runs four checks and emails an alert ONLY when
// something abnormal is found — no daily "all clear" noise.
//
// Checks:
//   1. Stuck webhooks   — Stripe events > 1h old with pending_webhooks > 0
//   2. Orphan payments  — Paid Stripe sessions in last 24h with no DB row
//   3. Amount mismatch  — Booking total != Stripe payment intent amount
//   4. Large bookings   — Any booking in last 24h totaling > $300 (review-worthy)

const STRIPE_API = "https://api.stripe.com/v1";
const LARGE_BOOKING_USD = 300;
// Accept any common separator: comma, semicolon, whitespace, newline.
const ALERT_EMAILS = (process.env.ALERT_EMAIL || "pjtanzillo@gmail.com")
  .split(/[\s,;]+/)
  .map((e) => e.trim())
  .filter(Boolean);

type Finding = { severity: "critical" | "warn"; title: string; detail: string };

async function stripeGet<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY missing" }, { status: 500 });
  }

  const findings: Finding[] = [];
  const supabase = createServerClient();
  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 60 * 60;
  const dayAgo = now - 24 * 60 * 60;

  // --- Check 1: stuck webhooks ---
  try {
    const events = await stripeGet<{ data: Array<{ id: string; type: string; created: number; pending_webhooks: number }> }>(
      `/events?limit=50&created[lte]=${oneHourAgo}&created[gte]=${dayAgo}`,
      stripeKey
    );
    const stuck = events.data.filter((e) => e.pending_webhooks > 0);
    if (stuck.length > 0) {
      findings.push({
        severity: "critical",
        title: `${stuck.length} Stripe event(s) have not been delivered to our webhook`,
        detail: stuck
          .map((e) => `• ${e.type} ${e.id} (created ${new Date(e.created * 1000).toISOString()})`)
          .join("\n"),
      });
    }
  } catch (err) {
    findings.push({
      severity: "warn",
      title: "Monitor failed to query Stripe events",
      detail: String(err),
    });
  }

  // --- Check 2: orphan paid sessions ---
  try {
    const sessions = await stripeGet<{
      data: Array<{ id: string; amount_total: number; payment_status: string; payment_intent: string | null; metadata: Record<string, string>; customer_email: string | null }>;
    }>(
      `/checkout/sessions?limit=100&created[gte]=${dayAgo}`,
      stripeKey
    );
    const paid = sessions.data.filter((s) => s.payment_status === "paid");
    const bookingIds = paid
      .map((s) => s.metadata?.booking_id)
      .filter((v): v is string => !!v);

    let existingIds = new Set<string>();
    if (bookingIds.length > 0) {
      const { data } = await supabase
        .from("bookings")
        .select("id")
        .in("id", bookingIds);
      existingIds = new Set((data || []).map((r) => r.id));
    }

    const orphans = paid.filter((s) => {
      const bid = s.metadata?.booking_id;
      // Only report real bookings (not tips). Tip sessions set metadata.type='tip'.
      return bid && s.metadata?.type !== "tip" && !existingIds.has(bid);
    });
    if (orphans.length > 0) {
      findings.push({
        severity: "critical",
        title: `${orphans.length} paid Stripe session(s) have no matching booking row`,
        detail: orphans
          .map((s) => `• $${(s.amount_total / 100).toFixed(2)} — ${s.customer_email} — session ${s.id} — booking_id ${s.metadata.booking_id}`)
          .join("\n"),
      });
    }
  } catch (err) {
    findings.push({
      severity: "warn",
      title: "Monitor failed to cross-check paid sessions",
      detail: String(err),
    });
  }

  // --- Check 3: amount mismatch ---
  try {
    const { data: recent } = await supabase
      .from("bookings")
      .select("id, total, tip_amount, stripe_payment_intent_id, created_at")
      .not("stripe_payment_intent_id", "is", null)
      .gte("created_at", new Date(dayAgo * 1000).toISOString())
      .limit(100);

    for (const b of recent || []) {
      try {
        const pi = await stripeGet<{ status: string; amount: number }>(
          `/payment_intents/${b.stripe_payment_intent_id}`,
          stripeKey
        );
        const expectedCents = Math.round((Number(b.total) + Number(b.tip_amount || 0)) * 100);
        if (pi.status !== "succeeded") {
          findings.push({
            severity: "critical",
            title: "Booking linked to non-succeeded payment intent",
            detail: `booking ${b.id} → ${b.stripe_payment_intent_id} status=${pi.status}`,
          });
        } else if (pi.amount !== expectedCents) {
          findings.push({
            severity: "critical",
            title: "Booking total does not match Stripe amount",
            detail: `booking ${b.id}: DB total $${(expectedCents / 100).toFixed(2)} vs Stripe $${(pi.amount / 100).toFixed(2)}`,
          });
        }
      } catch {
        // skip individual PI lookup failures
      }
    }
  } catch (err) {
    findings.push({
      severity: "warn",
      title: "Monitor failed to verify booking amounts",
      detail: String(err),
    });
  }

  // --- Check 4: large bookings (review-worthy, not necessarily bad) ---
  try {
    const { data: large } = await supabase
      .from("bookings")
      .select("id, total, tip_amount, status, created_at, customer:customers(full_name, email)")
      .gte("created_at", new Date(dayAgo * 1000).toISOString())
      .gte("total", LARGE_BOOKING_USD);

    if (large && large.length > 0) {
      findings.push({
        severity: "warn",
        title: `${large.length} booking(s) over $${LARGE_BOOKING_USD} in last 24h`,
        detail: large
          .map((b) => {
            const c = b.customer as unknown as { full_name: string; email: string } | null;
            return `• $${Number(b.total).toFixed(2)} — ${c?.full_name || "?"} <${c?.email || "?"}> — ${b.status} — ${b.id}`;
          })
          .join("\n"),
      });
    }
  } catch (err) {
    findings.push({
      severity: "warn",
      title: "Monitor failed to check for large bookings",
      detail: String(err),
    });
  }

  // --- Email if findings ---
  if (findings.length > 0) {
    const critical = findings.filter((f) => f.severity === "critical");
    const warn = findings.filter((f) => f.severity === "warn");
    const subject = critical.length > 0
      ? `🚨 ATX Scrubbin alert: ${critical.length} critical finding(s)`
      : `⚠️ ATX Scrubbin review: ${warn.length} finding(s)`;

    const html = `
      <h2 style="color:${critical.length ? "#b91c1c" : "#b45309"};font-family:sans-serif">
        ${subject}
      </h2>
      <p style="font-family:sans-serif;color:#374151">
        Automated health check at ${new Date().toISOString()}. See details below.
      </p>
      ${findings
        .map(
          (f) => `
        <div style="margin:16px 0;padding:12px;border-left:4px solid ${f.severity === "critical" ? "#dc2626" : "#d97706"};background:#f9fafb;font-family:sans-serif">
          <div style="font-weight:600;color:#111827">[${f.severity.toUpperCase()}] ${f.title}</div>
          <pre style="white-space:pre-wrap;font-size:13px;color:#374151;margin:8px 0 0">${f.detail.replace(/</g, "&lt;")}</pre>
        </div>`
        )
        .join("")}
      <p style="font-family:sans-serif;font-size:12px;color:#6b7280">
        If you want to stop these alerts, delete the /api/cron/monitor entry from vercel.json.
      </p>
    `;
    await Promise.all(ALERT_EMAILS.map((addr) => sendEmail(addr, subject, html)));
  }

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    findings_count: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    findings: findings.map((f) => ({ severity: f.severity, title: f.title })),
  });
}
