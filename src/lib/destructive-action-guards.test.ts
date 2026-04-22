import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, out);
    else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")))
      out.push(full);
  }
  return out;
}

// These tests scan the source tree for destructive patterns that have caused
// real incidents. They run as static checks — no runtime dependencies — so
// they're fast and can't be silently skipped.
//
// Incident history:
//   2026-04: /api/booking/checkout cleanup deleted a paid $100 booking
//   because it matched `status=confirmed AND stripe_payment_intent_id IS NULL`.
//   The webhook hadn't fired yet, so the "unpaid" heuristic was wrong.

const ROOT = path.resolve(__dirname, "..", "app", "api");

function rgFiles(pattern: string): string[] {
  try {
    const out = execSync(
      `grep -rl --include="*.ts" --include="*.tsx" -E ${JSON.stringify(pattern)} ${JSON.stringify(ROOT)}`,
      { encoding: "utf8" }
    );
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return []; // grep exits 1 when nothing matches
  }
}

function readAll(files: string[]): { path: string; text: string }[] {
  return files.map((p) => ({ path: p, text: readFileSync(p, "utf8") }));
}

describe("destructive action guards on bookings", () => {
  it("no route deletes bookings based on stripe_payment_intent_id being null", () => {
    // This was the exact broken pattern. Disallowed forever.
    const files = rgFiles('\\.is\\("stripe_payment_intent_id", null\\)');
    const offenders: string[] = [];

    for (const { path: fp, text } of readAll(files)) {
      // Check for a delete chain that also references the null payment intent.
      // Both conditions in the same statement = the bad pattern.
      const deleteRegex = /\.from\(["']bookings["']\)[\s\S]{0,400}?\.delete\(\)[\s\S]{0,800}?\.is\(["']stripe_payment_intent_id["'],\s*null\)/;
      if (deleteRegex.test(text)) offenders.push(fp);
    }

    expect(offenders).toEqual([]);
  });

  it("any bookings delete must be guarded by status=pending (or scoped by id only)", () => {
    // Find every `.from("bookings")....delete()` chain and verify the
    // filter in that chain includes `status` = `pending` OR only filters
    // by `id` (a targeted delete of a known row is fine; a broad delete
    // must be scoped to pending rows to be safe).
    const files = walkTs(ROOT);
    const offenders: { file: string; snippet: string }[] = [];

    const chainRegex = /\.from\(["']bookings["']\)([\s\S]{0,800}?)\.delete\(\)([\s\S]{0,800}?)(;|\n\s*\n)/g;

    for (const fp of files) {
      const text = readFileSync(fp, "utf8");
      let match;
      while ((match = chainRegex.exec(text)) !== null) {
        const full = match[0];
        const hasPendingGuard = /\.eq\(["']status["'],\s*["']pending["']\)/.test(full);
        // A delete scoped only to a single id is safe (e.g. the new cleanup
        // path deletes a specific row by id after verifying with Stripe).
        const scopedById = /\.eq\(["']id["'],\s*\w+\)/.test(full);
        // The cleanup in checkout/route.ts does both: eq("id", ...).eq("status", "pending")
        // Related-record cleanup (booking_addons, booking_team_members) is
        // not matched by this regex (it queries those tables, not "bookings").
        if (!hasPendingGuard && !scopedById) {
          offenders.push({ file: fp, snippet: full.slice(0, 300) });
        }
      }
    }

    if (offenders.length > 0) {
      console.error("Unsafe booking delete(s) found:", offenders);
    }
    expect(offenders).toEqual([]);
  });

  it("customer-facing booking creation uses status='pending' (admin path may differ)", () => {
    // Customer checkout must start as pending so the webhook can promote it
    // to confirmed. If this regresses, unpaid bookings will look confirmed
    // and the cleanup will never clean them up (or, worse, will wrongly
    // target confirmed rows).
    const checkoutRoute = readFileSync(
      path.join(ROOT, "booking", "checkout", "route.ts"),
      "utf8"
    );
    // Find the .insert({...}) block for bookings and check its status.
    const insertMatch = checkoutRoute.match(
      /\.from\(["']bookings["']\)\s*\.insert\(\{([\s\S]*?)\}\)/
    );
    expect(insertMatch, "Expected a bookings insert in checkout/route.ts").toBeTruthy();
    const body = insertMatch![1];
    expect(body).toMatch(/status:\s*["']pending["']/);
    expect(body).not.toMatch(/status:\s*["']confirmed["']/);
  });
});
