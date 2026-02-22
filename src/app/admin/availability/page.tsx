"use client";

import { useEffect, useState, useCallback } from "react";

interface TeamMember {
  id: string;
  display_name: string;
  active: boolean;
}

interface AvailabilitySlot {
  id: string;
  team_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

interface Override {
  id: string;
  team_member_id: string;
  date: string;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AvailabilityPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideAvailable, setOverrideAvailable] = useState(false);
  const [overrideStart, setOverrideStart] = useState("10:00");
  const [overrideEnd, setOverrideEnd] = useState("16:00");

  const loadAvailability = useCallback(async (memberId: string) => {
    const res = await fetch(`/api/availability?member_id=${memberId}`);
    if (res.ok) {
      const data = await res.json();
      setAvailability(data.availability || []);
      setOverrides(data.overrides || []);
    }
  }, []);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => {
        const active = data.filter((m: TeamMember) => m.active);
        setMembers(active);
        if (active.length > 0) {
          setSelectedMember(active[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedMember) {
      loadAvailability(selectedMember);
    }
  }, [selectedMember, loadAvailability]);

  async function toggleDay(dayOfWeek: number) {
    const existing = availability.find(
      (a) => a.team_member_id === selectedMember && a.day_of_week === dayOfWeek
    );

    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_member_id: selectedMember,
        day_of_week: dayOfWeek,
        start_time: existing?.start_time || "10:00",
        end_time: existing?.end_time || "16:00",
        active: existing ? !existing.active : true,
      }),
    });

    loadAvailability(selectedMember);
  }

  async function updateTime(dayOfWeek: number, field: "start_time" | "end_time", value: string) {
    const existing = availability.find(
      (a) => a.team_member_id === selectedMember && a.day_of_week === dayOfWeek
    );

    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_member_id: selectedMember,
        day_of_week: dayOfWeek,
        start_time: field === "start_time" ? value : existing?.start_time || "10:00",
        end_time: field === "end_time" ? value : existing?.end_time || "16:00",
        active: existing?.active ?? true,
      }),
    });

    loadAvailability(selectedMember);
  }

  async function addOverride() {
    if (!overrideDate) return;

    await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_member_id: selectedMember,
        date: overrideDate,
        available: overrideAvailable,
        start_time: overrideAvailable ? overrideStart : null,
        end_time: overrideAvailable ? overrideEnd : null,
      }),
    });

    setOverrideDate("");
    loadAvailability(selectedMember);
  }

  async function removeOverride(id: string) {
    await fetch(`/api/availability?id=${id}`, { method: "DELETE" });
    loadAvailability(selectedMember);
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  if (members.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1">Availability</h1>
        <p className="text-sm text-zinc-400 mb-8">Add team members first to set their schedules.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Availability</h1>
      <p className="text-sm text-zinc-400 mb-6">Set weekly schedules and day-off overrides</p>

      {/* Member picker */}
      <div className="mb-6">
        <label className="block text-xs text-zinc-400 mb-1">Team Member</label>
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>

      {/* Weekly schedule */}
      <div className="mb-8 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-900/80 px-4 py-3 text-xs text-zinc-500 font-semibold">
          Weekly Schedule
        </div>
        <div className="divide-y divide-zinc-800">
          {DAYS.map((day, i) => {
            const slot = availability.find(
              (a) => a.team_member_id === selectedMember && a.day_of_week === i
            );
            const isActive = slot?.active ?? false;

            return (
              <div key={day} className="flex items-center gap-4 px-4 py-3">
                <button
                  onClick={() => toggleDay(i)}
                  className={`w-20 text-left text-sm font-medium ${isActive ? "text-white" : "text-zinc-600"}`}
                >
                  {day.slice(0, 3)}
                </button>
                <button
                  onClick={() => toggleDay(i)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${isActive ? "bg-orange" : "bg-zinc-700"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition ${isActive ? "translate-x-4" : "translate-x-1"}`} />
                </button>
                {isActive && (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      value={slot?.start_time?.slice(0, 5) || "10:00"}
                      onChange={(e) => updateTime(i, "start_time", e.target.value)}
                      className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-orange focus:outline-none"
                    />
                    <span className="text-zinc-500">to</span>
                    <input
                      type="time"
                      value={slot?.end_time?.slice(0, 5) || "16:00"}
                      onChange={(e) => updateTime(i, "end_time", e.target.value)}
                      className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-orange focus:outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date overrides */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-900/80 px-4 py-3 text-xs text-zinc-500 font-semibold">
          Date Overrides
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Date</label>
              <input
                type="date"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Status</label>
              <select
                value={overrideAvailable ? "available" : "off"}
                onChange={(e) => setOverrideAvailable(e.target.value === "available")}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
              >
                <option value="off">Day Off</option>
                <option value="available">Custom Hours</option>
              </select>
            </div>
            {overrideAvailable && (
              <>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Start</label>
                  <input
                    type="time"
                    value={overrideStart}
                    onChange={(e) => setOverrideStart(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">End</label>
                  <input
                    type="time"
                    value={overrideEnd}
                    onChange={(e) => setOverrideEnd(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                  />
                </div>
              </>
            )}
            <button
              onClick={addOverride}
              disabled={!overrideDate}
              className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold transition hover:bg-orange-dark disabled:opacity-50"
            >
              Add Override
            </button>
          </div>

          {overrides.length > 0 && (
            <div className="space-y-2">
              {overrides.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{o.date}</span>
                    <span className="text-zinc-400 ml-3">
                      {o.available
                        ? `Custom: ${o.start_time?.slice(0, 5)} - ${o.end_time?.slice(0, 5)}`
                        : "Day Off"}
                    </span>
                  </div>
                  <button
                    onClick={() => removeOverride(o.id)}
                    className="text-zinc-500 hover:text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {overrides.length === 0 && (
            <p className="text-sm text-zinc-600">No overrides set. Use this for days off or holiday schedules.</p>
          )}
        </div>
      </div>
    </div>
  );
}
