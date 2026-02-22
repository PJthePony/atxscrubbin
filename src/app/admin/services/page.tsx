"use client";

import { useEffect, useState } from "react";
import type { CarSize } from "@/types";

const emptyForm = {
  name: "",
  description: "",
  base_price: "",
  wash_time_minutes: "",
  sort_order: "",
};

export default function ServicesPage() {
  const [services, setServices] = useState<CarSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setForm(emptyForm);
    setEditing("new");
  }

  function startEdit(s: CarSize) {
    setForm({
      name: s.name,
      description: s.description,
      base_price: String(s.base_price),
      wash_time_minutes: String(s.wash_time_minutes),
      sort_order: String(s.sort_order),
    });
    setEditing(s.id);
  }

  function cancel() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...(editing !== "new" ? { id: editing } : {}),
      name: form.name,
      description: form.description,
      base_price: parseFloat(form.base_price),
      wash_time_minutes: parseInt(form.wash_time_minutes),
      sort_order: parseInt(form.sort_order) || 0,
    };

    await fetch("/api/services", {
      method: editing === "new" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this car size?")) return;
    await fetch(`/api/services?id=${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Services & Pricing</h1>
          <p className="text-sm text-zinc-400">Manage car sizes and base prices</p>
        </div>
        <button
          onClick={startNew}
          className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold transition hover:bg-orange-dark"
        >
          + Add Size
        </button>
      </div>

      {/* Form */}
      {editing && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="font-semibold mb-4">
            {editing === "new" ? "New Car Size" : "Edit Car Size"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="Small"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Base Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.base_price}
                onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="40.00"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Wash Time (min)</label>
              <input
                type="number"
                value={form.wash_time_minutes}
                onChange={(e) => setForm({ ...form, wash_time_minutes: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="45"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="Sedans, coupes, compact cars"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="1"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={save}
              disabled={saving || !form.name || !form.base_price || !form.wash_time_minutes}
              className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold transition hover:bg-orange-dark disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={cancel}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {services.map((s) => (
              <tr key={s.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-zinc-400">{s.description}</td>
                <td className="px-4 py-3">${Number(s.base_price).toFixed(2)}</td>
                <td className="px-4 py-3">{s.wash_time_minutes} min</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${s.active ? "bg-green-500/10 text-green-400" : "bg-zinc-700/50 text-zinc-400"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(s)} className="text-zinc-400 hover:text-white mr-3 text-xs">
                    Edit
                  </button>
                  <button onClick={() => remove(s.id)} className="text-zinc-500 hover:text-red-400 text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No car sizes yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
