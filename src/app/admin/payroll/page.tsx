"use client";

import { useEffect, useState, useCallback } from "react";

interface MemberPayroll {
  id: string;
  name: string;
  washEarnings: number;
  tipEarnings: number;
  totalEarnings: number;
  washCount: number;
}

interface BookingDetail {
  id: string;
  date: string;
  time: string;
  customer: string;
  service: string;
  total: number;
  tip: number;
  crewShare: number;
  companyShare: number;
  members: string[];
}

interface PayrollData {
  weekStart: string;
  weekEnd: string;
  totalRevenue: number;
  totalTips: number;
  companyShare: number;
  crewShare: number;
  bookingCount: number;
  members: MemberPayroll[];
  bookings: BookingDetail[];
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatWeekRange(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  const sameMonth = s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export default function PayrollPage() {
  const [weekStart, setWeekStart] = useState(() => {
    // Default to last completed week (previous Monday)
    const now = new Date();
    const thisMonday = getMonday(now);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    return toDateStr(lastMonday);
  });
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookings, setShowBookings] = useState(false);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payroll?weekStart=${weekStart}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } catch {
      // failed to load
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  function shiftWeek(offset: number) {
    const [y, m, d] = weekStart.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offset * 7);
    setWeekStart(toDateStr(date));
  }

  // Don't allow navigating past current week
  const thisMonday = getMonday(new Date());
  const [wy, wm, wd] = weekStart.split("-").map(Number);
  const selectedMonday = new Date(wy, wm - 1, wd);
  const canGoForward = selectedMonday < thisMonday;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Payroll</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Weekly earnings breakdown — 75% crew / 25% company. Tips go 100% to
        crew.
      </p>

      {/* Week selector */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => shiftWeek(-1)}
          className="p-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 transition"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="text-center min-w-[240px]">
          {data ? (
            <>
              <p className="font-semibold text-lg">
                {formatWeekRange(data.weekStart, data.weekEnd)}
              </p>
              <p className="text-xs text-zinc-500">
                Week of {formatDate(data.weekStart)}
              </p>
            </>
          ) : (
            <p className="text-zinc-500">Loading...</p>
          )}
        </div>

        <button
          onClick={() => shiftWeek(1)}
          disabled={!canGoForward}
          className={`p-2 rounded-lg border border-zinc-800 transition ${
            canGoForward
              ? "hover:bg-zinc-900"
              : "opacity-30 cursor-not-allowed"
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-500 py-12 text-center">
          Loading payroll...
        </div>
      ) : !data || data.bookingCount === 0 ? (
        <div className="text-zinc-500 py-12 text-center">
          No completed washes this week.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-xs text-zinc-500 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold">${data.totalRevenue}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {data.bookingCount} wash
                {data.bookingCount !== 1 ? "es" : ""}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-xs text-zinc-500 mb-1">Company (25%)</p>
              <p className="text-2xl font-bold text-blue-400">
                ${data.companyShare}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Supplies & operations
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-xs text-zinc-500 mb-1">Crew (75%)</p>
              <p className="text-2xl font-bold text-green-400">
                ${data.crewShare}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Split among workers
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-xs text-zinc-500 mb-1">Tips</p>
              <p className="text-2xl font-bold text-orange">
                ${data.totalTips}
              </p>
              <p className="text-xs text-zinc-500 mt-1">100% to crew</p>
            </div>
          </div>

          {/* Individual payouts */}
          <h2 className="text-lg font-semibold mb-4">Individual Payouts</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left text-xs text-zinc-500 font-medium px-5 py-3">
                    Team Member
                  </th>
                  <th className="text-right text-xs text-zinc-500 font-medium px-5 py-3">
                    Washes
                  </th>
                  <th className="text-right text-xs text-zinc-500 font-medium px-5 py-3">
                    Wash Pay
                  </th>
                  <th className="text-right text-xs text-zinc-500 font-medium px-5 py-3">
                    Tips
                  </th>
                  <th className="text-right text-xs text-zinc-500 font-medium px-5 py-3">
                    Total Owed
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-zinc-800/50 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium">{member.name}</td>
                    <td className="px-5 py-3 text-right text-zinc-400">
                      {member.washCount}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-400">
                      ${member.washEarnings.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right text-orange">
                      ${member.tipEarnings.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-green-400">
                      ${member.totalEarnings.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Booking details (collapsible) */}
          <button
            onClick={() => setShowBookings(!showBookings)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition mb-4"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showBookings ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {showBookings ? "Hide" : "Show"} Booking Breakdown (
            {data.bookings.length})
          </button>

          {showBookings && (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">
                      Date
                    </th>
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">
                      Customer
                    </th>
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">
                      Service
                    </th>
                    <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">
                      Total
                    </th>
                    <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">
                      Tip
                    </th>
                    <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">
                      Company
                    </th>
                    <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">
                      Crew
                    </th>
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">
                      Crew
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-zinc-800/50 last:border-0"
                    >
                      <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">
                        {formatDate(b.date)} {formatTime(b.time)}
                      </td>
                      <td className="px-4 py-2.5">{b.customer}</td>
                      <td className="px-4 py-2.5 text-zinc-400">{b.service}</td>
                      <td className="px-4 py-2.5 text-right">${b.total}</td>
                      <td className="px-4 py-2.5 text-right text-orange">
                        {b.tip > 0 ? `$${b.tip}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-blue-400">
                        ${b.companyShare.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-green-400">
                        ${b.crewShare.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        {b.members.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
