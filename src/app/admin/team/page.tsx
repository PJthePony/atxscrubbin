"use client";

import { useEffect, useState } from "react";

interface TeamMember {
  id: string;
  username: string;
  display_name: string;
  phone: string;
  email: string;
  role: string;
  active: boolean;
}

const emptyForm = {
  username: "",
  display_name: "",
  password: "",
  phone: "",
  email: "",
  role: "member",
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/team");
    if (res.ok) {
      setMembers(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setForm(emptyForm);
    setEditing("new");
    setError("");
  }

  function startEdit(m: TeamMember) {
    setForm({
      username: m.username,
      display_name: m.display_name,
      password: "",
      phone: m.phone,
      email: m.email,
      role: m.role,
    });
    setEditing(m.id);
    setError("");
  }

  function cancel() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      display_name: form.display_name,
      phone: form.phone,
      email: form.email,
      role: form.role,
    };

    if (editing === "new") {
      payload.username = form.username;
      payload.password = form.password;
    } else {
      payload.id = editing;
      if (form.password) payload.password = form.password;
    }

    const res = await fetch("/api/team", {
      method: editing === "new" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  }

  async function toggleActive(m: TeamMember) {
    await fetch("/api/team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, active: !m.active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this team member? This cannot be undone.")) return;
    const res = await fetch(`/api/team?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to delete");
      return;
    }
    load();
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-zinc-400">Manage who can log in and work bookings</p>
        </div>
        <button
          onClick={startNew}
          className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold transition hover:bg-orange-dark"
        >
          + Add Member
        </button>
      </div>

      {editing && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="font-semibold mb-4">
            {editing === "new" ? "New Team Member" : "Edit Team Member"}
          </h3>
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Display Name</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="Carter"
              />
            </div>
            {editing === "new" && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Username</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                  placeholder="carter"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {editing === "new" ? "Password" : "New Password (leave blank to keep)"}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="(512) 555-1234"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
                placeholder="carter@atxscrubbin.com"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={save}
              disabled={saving || !form.display_name || (editing === "new" && (!form.username || !form.password))}
              className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold transition hover:bg-orange-dark disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={cancel} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table (desktop) */}
      <div className="hidden sm:block rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-medium">{m.display_name}</td>
                <td className="px-4 py-3 text-zinc-400">{m.username}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${m.role === "admin" ? "bg-orange/10 text-orange" : "bg-zinc-700/50 text-zinc-400"}`}>
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{m.phone || "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(m)}
                    className={`inline-block rounded-full px-2 py-0.5 text-xs cursor-pointer ${m.active ? "bg-green-500/10 text-green-400" : "bg-zinc-700/50 text-zinc-400"}`}
                  >
                    {m.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(m)} className="text-zinc-400 hover:text-white mr-3 text-xs">
                    Edit
                  </button>
                  <button onClick={() => remove(m.id)} className="text-zinc-500 hover:text-red-400 text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No team members yet. Add Carter and Augie to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="sm:hidden space-y-3">
        {members.map((m) => (
          <div key={m.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium">{m.display_name}</p>
                <p className="text-xs text-zinc-500">@{m.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${m.role === "admin" ? "bg-orange/10 text-orange" : "bg-zinc-700/50 text-zinc-400"}`}>
                  {m.role}
                </span>
                <button
                  onClick={() => toggleActive(m)}
                  className={`inline-block rounded-full px-2 py-0.5 text-xs cursor-pointer ${m.active ? "bg-green-500/10 text-green-400" : "bg-zinc-700/50 text-zinc-400"}`}
                >
                  {m.active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
            {m.phone && <p className="text-sm text-zinc-400 mb-2">📱 {m.phone}</p>}
            <div className="flex gap-3 text-xs">
              <button onClick={() => startEdit(m)} className="text-zinc-400 hover:text-white">Edit</button>
              <button onClick={() => remove(m.id)} className="text-zinc-500 hover:text-red-400">Delete</button>
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
            No team members yet. Add Carter and Augie to get started.
          </div>
        )}
      </div>
    </div>
  );
}
