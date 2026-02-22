"use client";

import { useEffect, useState } from "react";

interface Coordinate {
  lat: number;
  lng: number;
}

export default function ServiceAreaPage() {
  const [polygon, setPolygon] = useState<Coordinate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");

  useEffect(() => {
    fetch("/api/service-area")
      .then((r) => r.json())
      .then((data) => {
        if (data?.polygon?.coordinates?.[0]) {
          setPolygon(
            data.polygon.coordinates[0].map((c: number[]) => ({
              lat: c[1],
              lng: c[0],
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addPoint() {
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    if (isNaN(lat) || isNaN(lng)) return;
    setPolygon([...polygon, { lat, lng }]);
    setNewLat("");
    setNewLng("");
  }

  function removePoint(index: number) {
    setPolygon(polygon.filter((_, i) => i !== index));
  }

  async function savePolygon() {
    if (polygon.length < 3) {
      alert("Need at least 3 points to form a service area");
      return;
    }

    setSaving(true);
    setSaved(false);

    const coords = polygon.map((p) => [p.lng, p.lat]);
    coords.push(coords[0]);

    await fetch("/api/service-area", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon: { type: "Polygon", coordinates: [coords] },
      }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function loadAustinDefault() {
    setPolygon([
      { lat: 30.45, lng: -97.85 },
      { lat: 30.45, lng: -97.65 },
      { lat: 30.20, lng: -97.65 },
      { lat: 30.20, lng: -97.85 },
    ]);
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Service Area</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Define where you offer service. Interactive map drawing available once Google Maps API is connected.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Boundary Points</h3>
            <button onClick={loadAustinDefault} className="text-xs text-orange hover:text-orange-dark transition">
              Load Austin Default
            </button>
          </div>

          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {polygon.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm">
                <span><span className="text-zinc-500 mr-2">#{i + 1}</span>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                <button onClick={() => removePoint(i)} className="text-zinc-500 hover:text-red-400 text-xs">Remove</button>
              </div>
            ))}
            {polygon.length === 0 && (
              <p className="text-sm text-zinc-600 py-4 text-center">No points yet. Add coordinates or load the Austin default.</p>
            )}
          </div>

          <div className="flex gap-2">
            <input type="number" step="0.0001" placeholder="Latitude" value={newLat} onChange={(e) => setNewLat(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none" />
            <input type="number" step="0.0001" placeholder="Longitude" value={newLng} onChange={(e) => setNewLng(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none" />
            <button onClick={addPoint} className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-700 transition">Add</button>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button onClick={savePolygon} disabled={saving || polygon.length < 3}
              className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold transition hover:bg-orange-dark disabled:opacity-50">
              {saving ? "Saving..." : "Save Service Area"}
            </button>
            {saved && <span className="text-sm text-green-400">Saved!</span>}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="h-80 lg:h-full min-h-[300px] flex items-center justify-center text-zinc-600">
            <div className="text-center px-6">
              <svg className="w-12 h-12 mx-auto mb-3 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm font-medium mb-1">Interactive Map</p>
              <p className="text-xs text-zinc-700">
                Connect your Google Maps API key to draw the service area visually.
                {polygon.length >= 3 && <span className="block mt-2 text-orange">{polygon.length} points saved</span>}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
