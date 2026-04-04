"use client";

import { useEffect, useState } from "react";

interface SettingsForm {
  travel_buffer_minutes: string;
  default_start_time: string;
  default_end_time: string;
  min_team_members_per_booking: string;
  slot_increment_minutes: string;
}

const defaults: SettingsForm = {
  travel_buffer_minutes: "15",
  default_start_time: "10:00",
  default_end_time: "16:00",
  min_team_members_per_booking: "2",
  slot_increment_minutes: "30",
};

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setForm({
          travel_buffer_minutes: String(data.travel_buffer_minutes ?? defaults.travel_buffer_minutes),
          default_start_time: String(data.default_start_time ?? defaults.default_start_time).replace(/"/g, ""),
          default_end_time: String(data.default_end_time ?? defaults.default_end_time).replace(/"/g, ""),
          min_team_members_per_booking: String(data.min_team_members_per_booking ?? defaults.min_team_members_per_booking),
          slot_increment_minutes: String(data.slot_increment_minutes ?? defaults.slot_increment_minutes),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        travel_buffer_minutes: parseInt(form.travel_buffer_minutes),
        default_start_time: form.default_start_time,
        default_end_time: form.default_end_time,
        min_team_members_per_booking: parseInt(form.min_team_members_per_booking),
        slot_increment_minutes: parseInt(form.slot_increment_minutes),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function syncCalendar() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/calendar/backfill", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const { availability, bookings } = data.results;
        setSyncResult(`Synced ${availability.synced} availability slots and ${bookings.synced} bookings to Google Calendar.`);
      } else {
        setSyncResult("Sync failed: " + (data.error || "Unknown error"));
      }
    } catch {
      setSyncResult("Sync failed. Check your Google Calendar credentials.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-zinc-400 mb-8">
        Configure scheduling and booking defaults
      </p>

      <div className="max-w-lg space-y-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <h3 className="font-semibold text-sm">Scheduling</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Default Start Time</label>
              <input
                type="time"
                value={form.default_start_time}
                onChange={(e) => setForm({ ...form, default_start_time: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Default End Time</label>
              <input
                type="time"
                value={form.default_end_time}
                onChange={(e) => setForm({ ...form, default_end_time: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Travel Buffer (minutes)</label>
            <input
              type="number"
              value={form.travel_buffer_minutes}
              onChange={(e) => setForm({ ...form, travel_buffer_minutes: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
            />
            <p className="text-xs text-zinc-600 mt-1">Buffer between bookings for travel time</p>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Time Slot Increments (minutes)</label>
            <input
              type="number"
              value={form.slot_increment_minutes}
              onChange={(e) => setForm({ ...form, slot_increment_minutes: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
            />
            <p className="text-xs text-zinc-600 mt-1">Available start times at 30-minute intervals</p>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Min Team Members Per Booking</label>
            <input
              type="number"
              value={form.min_team_members_per_booking}
              onChange={(e) => setForm({ ...form, min_team_members_per_booking: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
            />
            <p className="text-xs text-zinc-600 mt-1">Require this many team members available to offer a slot</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-orange px-5 py-2 text-sm font-semibold transition hover:bg-orange-dark disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button
            onClick={syncCalendar}
            disabled={syncing}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-semibold transition hover:border-zinc-500 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync Google Calendar"}
          </button>
          {saved && <span className="text-sm text-green-400">Saved!</span>}
          {syncResult && <span className="text-sm text-zinc-400">{syncResult}</span>}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
          <h3 className="font-semibold text-sm">Google Calendar</h3>
          <p className="text-xs text-zinc-400">
            Sync all existing availability and bookings to Google Calendar. Only unsynced records will be added — safe to run multiple times.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={syncCalendar}
              disabled={syncing}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2 text-sm font-semibold transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync with Google Calendar"}
            </button>
            {syncResult && (
              <span className={`text-sm ${syncResult.startsWith("Sync failed") ? "text-red-400" : "text-green-400"}`}>
                {syncResult}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
