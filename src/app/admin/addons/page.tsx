"use client";

import { useEffect, useState } from "react";
import type { Addon } from "@/types";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  time_minutes: "",
  sort_order: "",
};

export default function AddonsPage() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/addons");
    const data = await res.json();
    setAddons(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setForm(emptyForm);
    setEditing("new");
  }

  function startEdit(a: Addon) {
    setForm({
      name: a.name,
      description: a.description,
      price: String(a.price),
      time_minutes: String(a.time_minutes),
      sort_order: String(a.sort_order),
    });
    setEditing(a.id);
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
      price: parseFloat(form.price),
      time_minutes: parseInt(form.time_minutes) || 0,
      sort_order: parseInt(form.sort_order) || 0,
    };

    await fetch("/api/addons", {
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
    if (!confirm("Delete this add-on?")) return;
    const res = await fetch(`/api/addons?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.deactivated) {
      alert("This add-on was used in past bookings, so it's been deactivated instead of deleted.");
    }
    load();
  }

  async function moveAddon(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= addons.length) return;

    const a = addons[index];
    const b = addons[swapIndex];

    // Swap sort_order values; if equal, offset to ensure a real swap
    const newAOrder = a.sort_order === b.sort_order
      ? (direction === "up" ? a.sort_order - 1 : a.sort_order + 1)
      : b.sort_order;
    const newBOrder = a.sort_order === b.sort_order ? a.sort_order : a.sort_order;

    await Promise.all([
      fetch("/api/addons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, sort_order: newAOrder }),
      }),
      fetch("/api/addons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, sort_order: newBOrder }),
      }),
    ]);
    load();
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Add-ons</h1>
          <p className="text-sm text-zinc-400">Extra services customers can add to their wash</p>
        </div>
        <button
          onClick={startNew}
          className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold transition hover:bg-orange-dark"
        >
          + Add Add-on
        </button>
      </div>

      {/* Form */}
      {editing && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="font-semibold mb-4">
            {editing === "new" ? "New Add-on" : "Edit Add-on"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="Interior Detail"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="25.00"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Extra Time (min)</label>
              <input
                type="number"
                value={form.time_minutes}
                onChange={(e) => setForm({ ...form, time_minutes: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="15"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="Full interior vacuum and wipe-down"
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
              disabled={saving || !form.name || !form.price}
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
              <th className="px-3 py-3 w-16">Order</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Extra Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {addons.map((a, i) => (
              <tr key={a.id} className="hover:bg-zinc-900/40">
                <td className="px-3 py-3">
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={() => moveAddon(i, "up")}
                      disabled={i === 0}
                      className="text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition p-0.5"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      onClick={() => moveAddon(i, "down")}
                      disabled={i === addons.length - 1}
                      className="text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition p-0.5"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3 text-zinc-400">{a.description}</td>
                <td className="px-4 py-3">${Number(a.price).toFixed(2)}</td>
                <td className="px-4 py-3">{a.time_minutes > 0 ? `+${a.time_minutes} min` : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${a.active ? "bg-green-500/10 text-green-400" : "bg-zinc-700/50 text-zinc-400"}`}>
                    {a.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(a)} className="text-zinc-400 hover:text-white mr-3 text-xs">
                    Edit
                  </button>
                  <button onClick={() => remove(a.id)} className="text-zinc-500 hover:text-red-400 text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {addons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No add-ons yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
