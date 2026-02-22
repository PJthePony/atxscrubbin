"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const quickLinks = [
  { href: "/admin/today", label: "Today's Schedule", desc: "See what's on deck" },
  { href: "/admin/bookings", label: "All Bookings", desc: "View and manage bookings" },
  { href: "/admin/services", label: "Services & Pricing", desc: "Edit car sizes and prices" },
  { href: "/admin/addons", label: "Add-ons", desc: "Manage add-on services" },
  { href: "/admin/team", label: "Team", desc: "Manage team members" },
  { href: "/admin/service-area", label: "Service Area", desc: "Update your coverage zone" },
];

interface Stats {
  todayCount: number;
  weekCount: number;
  monthRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    todayCount: 0,
    weekCount: 0,
    monthRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const today = new Date().toISOString().split("T")[0];

        // Get start of week (Sunday)
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Get start/end of month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];

        const [todayRes, weekRes, monthRes] = await Promise.all([
          fetch(`/api/admin/bookings?date=${today}`),
          fetch(
            `/api/admin/bookings?from=${weekStart.toISOString().split("T")[0]}&to=${weekEnd.toISOString().split("T")[0]}`
          ),
          fetch(`/api/admin/bookings?from=${monthStart}&to=${monthEnd}`),
        ]);

        const [todayData, weekData, monthData] = await Promise.all([
          todayRes.json(),
          weekRes.json(),
          monthRes.json(),
        ]);

        const activeStatuses = ["confirmed", "in_progress", "completed"];

        const todayBookings = (todayData.bookings || []).filter(
          (b: { status: string }) => activeStatuses.includes(b.status)
        );
        const weekBookings = (weekData.bookings || []).filter(
          (b: { status: string }) => activeStatuses.includes(b.status)
        );
        const monthBookings = (monthData.bookings || []).filter(
          (b: { status: string }) => activeStatuses.includes(b.status)
        );

        setStats({
          todayCount: todayBookings.length,
          weekCount: weekBookings.length,
          monthRevenue: monthBookings.reduce(
            (sum: number, b: { total: number }) => sum + b.total,
            0
          ),
        });
      } catch {
        // Stats will stay at 0
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-zinc-400 text-sm mb-8">
        Welcome back. Here&apos;s your command center.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs text-zinc-500 mb-1">Today&apos;s Bookings</p>
          <p className="text-2xl font-bold">
            {loading ? "..." : stats.todayCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs text-zinc-500 mb-1">This Week</p>
          <p className="text-2xl font-bold">
            {loading ? "..." : stats.weekCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs text-zinc-500 mb-1">Revenue (Month)</p>
          <p className="text-2xl font-bold">
            {loading ? "..." : `$${stats.monthRevenue}`}
          </p>
        </div>
      </div>

      {/* Quick links */}
      <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-zinc-800 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <p className="font-semibold mb-1">{link.label}</p>
            <p className="text-sm text-zinc-400">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
