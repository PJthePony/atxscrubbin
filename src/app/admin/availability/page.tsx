"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface TeamMember {
  id: string;
  display_name: string;
  active: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function AvailabilityPage() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDate(today), [today]);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [myDates, setMyDates] = useState<Set<string>>(new Set());
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const currentMonthIndex = today.getFullYear() * 12 + today.getMonth();

  const loadAvailability = useCallback(
    async (memberId: string) => {
      const from = formatDate(today);
      // Fetch through end of month 12 months ahead
      const toDate = new Date(today.getFullYear(), today.getMonth() + 13, 0);
      const to = formatDate(toDate);
      const res = await fetch(
        `/api/availability?member_id=${memberId}&from=${from}&to=${to}`
      );
      if (res.ok) {
        const data = await res.json();
        setMyDates(new Set(data.myDates as string[]));
        setTeamCounts(data.teamCounts as Record<string, number>);
      }
    },
    [today]
  );

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => {
        const active = (data as TeamMember[]).filter((m) => m.active);
        setMembers(active);
        if (active.length > 0) setSelectedMember(active[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedMember) loadAvailability(selectedMember);
  }, [selectedMember, loadAvailability]);

  async function toggleDate(dateStr: string) {
    if (saving) return;
    const isAvailable = myDates.has(dateStr);
    setSaving(dateStr);

    // Optimistic update
    const newMyDates = new Set(myDates);
    const newCounts = { ...teamCounts };
    if (isAvailable) {
      newMyDates.delete(dateStr);
      const prev = newCounts[dateStr] || 0;
      if (prev <= 1) delete newCounts[dateStr];
      else newCounts[dateStr] = prev - 1;
    } else {
      newMyDates.add(dateStr);
      newCounts[dateStr] = (newCounts[dateStr] || 0) + 1;
    }
    setMyDates(newMyDates);
    setTeamCounts(newCounts);

    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_member_id: selectedMember,
        date: dateStr,
        available: !isAvailable,
      }),
    });

    if (!res.ok) {
      setMyDates(myDates);
      setTeamCounts(teamCounts);
    }
    setSaving(null);
  }

  function prevMonth() {
    const idx = viewYear * 12 + viewMonth;
    if (idx <= currentMonthIndex) return;
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    const idx = viewYear * 12 + viewMonth;
    if (idx >= currentMonthIndex + 12) return;
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  if (members.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1">Availability</h1>
        <p className="text-sm text-zinc-400">Add team members first to set their schedules.</p>
      </div>
    );
  }

  const viewMonthIndex = viewYear * 12 + viewMonth;
  const isFirstMonth = viewMonthIndex <= currentMonthIndex;
  const isLastMonth = viewMonthIndex >= currentMonthIndex + 12;

  const days = getMonthDays(viewYear, viewMonth);
  const firstDow = days[0].getDay();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Availability</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Click days to mark availability (11am – 4pm). Bookings open when 2+ crew are available.
      </p>

      {/* Member picker */}
      <div className="mb-6">
        <label className="block text-xs text-zinc-400 mb-1">Team Member</label>
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-orange/20 border border-orange/40" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
            2
          </span>
          <span>2+ crew = bookings open</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-yellow-500 text-zinc-900 text-[10px] font-bold flex items-center justify-center">
            1
          </span>
          <span>1 crew = need one more</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80">
          <button
            onClick={prevMonth}
            disabled={isFirstMonth}
            className="w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed text-zinc-400 hover:text-white transition"
          >
            ‹
          </button>
          <span className="text-sm font-semibold">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={isLastMonth}
            className="w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed text-zinc-400 hover:text-white transition"
          >
            ›
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900/40">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-xs text-zinc-600 py-2 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div
              key={`pad-${i}`}
              className="aspect-square border-r border-b border-zinc-800/30"
            />
          ))}
          {days.map((day) => {
            const dateStr = formatDate(day);
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const isAvail = myDates.has(dateStr);
            const count = teamCounts[dateStr] || 0;
            const isSaving = saving === dateStr;

            return (
              <button
                key={dateStr}
                onClick={() => !isPast && !isSaving && toggleDate(dateStr)}
                disabled={isPast}
                className={[
                  "relative aspect-square flex flex-col items-center justify-center",
                  "border-r border-b border-zinc-800/30 transition-colors select-none",
                  isPast
                    ? "opacity-25 cursor-not-allowed"
                    : "cursor-pointer",
                  !isPast && isAvail
                    ? "bg-orange/15 hover:bg-orange/25"
                    : !isPast
                    ? "hover:bg-zinc-800/50"
                    : "",
                  isToday ? "ring-1 ring-inset ring-orange/50" : "",
                  isSaving ? "opacity-60" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span
                  className={`text-sm font-medium leading-none ${
                    isAvail
                      ? "text-orange"
                      : isToday
                      ? "text-orange/60"
                      : "text-zinc-400"
                  }`}
                >
                  {day.getDate()}
                </span>
                {count > 0 && (
                  <span
                    className={[
                      "absolute bottom-1 right-1 text-[9px] font-bold w-3.5 h-3.5 rounded-full",
                      "flex items-center justify-center leading-none",
                      count >= 2
                        ? "bg-green-600 text-white"
                        : "bg-yellow-500 text-zinc-900",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
