"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface Coordinate {
  lat: number;
  lng: number;
}

function PolygonOverlay({ paths }: { paths: Coordinate[] }) {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map) return;

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }

    if (paths.length < 3) return;

    polygonRef.current = new google.maps.Polygon({
      paths,
      fillColor: "#FFA000",
      fillOpacity: 0.2,
      strokeColor: "#FFA000",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      map,
    });

    return () => {
      polygonRef.current?.setMap(null);
    };
  }, [map, paths]);

  return null;
}

function ClickListener({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onMapClick]);

  return null;
}

function ServiceAreaMapPanel({
  polygon,
  onMapClick,
}: {
  polygon: Coordinate[];
  onMapClick: (lat: number, lng: number) => void;
}) {
  const center =
    polygon.length >= 3
      ? {
          lat: polygon.reduce((s, p) => s + p.lat, 0) / polygon.length,
          lng: polygon.reduce((s, p) => s + p.lng, 0) / polygon.length,
        }
      : { lat: 30.3, lng: -97.75 };

  return (
    <div className="h-80 lg:h-full min-h-[300px]">
      <Map
        defaultCenter={center}
        defaultZoom={11}
        gestureHandling="greedy"
        mapId="service-area-admin"
        style={{ width: "100%", height: "100%" }}
      >
        <PolygonOverlay paths={polygon} />
        <ClickListener onMapClick={onMapClick} />
      </Map>
    </div>
  );
}

function MapPlaceholder({ pointCount }: { pointCount: number }) {
  return (
    <div className="h-80 lg:h-full min-h-[300px] flex items-center justify-center text-zinc-600">
      <div className="text-center px-6">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-zinc-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <p className="text-sm font-medium mb-1">Interactive Map</p>
        <p className="text-xs text-zinc-700">
          Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the interactive map.
          {pointCount >= 3 && (
            <span className="block mt-2 text-orange">
              {pointCount} points saved
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export default function ServiceAreaPage() {
  const [polygon, setPolygon] = useState<Coordinate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function addPoint(lat?: number, lng?: number) {
    const parsedLat = lat ?? parseFloat(newLat);
    const parsedLng = lng ?? parseFloat(newLng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) return;
    setPolygon([...polygon, { lat: parsedLat, lng: parsedLng }]);
    setNewLat("");
    setNewLng("");
  }

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPolygon((prev) => [
      ...prev,
      {
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
      },
    ]);
  }, []);

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
      { lat: 30.2, lng: -97.65 },
      { lat: 30.2, lng: -97.85 },
    ]);
  }

  function handleKMLUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/xml");

        // Look for coordinates in all common KML elements
        const coordElements = doc.querySelectorAll("coordinates");
        const points: Coordinate[] = [];

        coordElements.forEach((el) => {
          const raw = el.textContent?.trim();
          if (!raw) return;

          // KML coordinates are "lng,lat,alt" separated by whitespace
          const pairs = raw.split(/\s+/).filter(Boolean);
          pairs.forEach((pair) => {
            const parts = pair.split(",");
            if (parts.length >= 2) {
              const lng = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                points.push({
                  lat: Math.round(lat * 10000) / 10000,
                  lng: Math.round(lng * 10000) / 10000,
                });
              }
            }
          });
        });

        // Remove duplicate closing point if present
        if (
          points.length > 1 &&
          points[0].lat === points[points.length - 1].lat &&
          points[0].lng === points[points.length - 1].lng
        ) {
          points.pop();
        }

        if (points.length < 3) {
          alert(
            "Could not find enough coordinates in the KML file. Make sure it contains a polygon with at least 3 points."
          );
          return;
        }

        setPolygon(points);
      } catch {
        alert("Failed to parse KML file. Make sure it's a valid KML file.");
      }
    };
    reader.readAsText(file);

    // Reset so re-uploading the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Service Area</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Define where you offer service. Click the map to add points, or upload a
        KML file.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Boundary Points</h3>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".kml,.kmz"
                onChange={handleKMLUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-orange hover:text-orange-dark transition flex items-center gap-1"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload KML
              </button>
              <span className="text-zinc-700">|</span>
              <button
                onClick={loadAustinDefault}
                className="text-xs text-orange hover:text-orange-dark transition"
              >
                Load Austin Default
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {polygon.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
              >
                <span>
                  <span className="text-zinc-500 mr-2">#{i + 1}</span>
                  {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                </span>
                <button
                  onClick={() => removePoint(i)}
                  className="text-zinc-500 hover:text-red-400 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
            {polygon.length === 0 && (
              <p className="text-sm text-zinc-600 py-4 text-center">
                No points yet. Click the map, add coordinates, or upload a KML
                file.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              step="0.0001"
              placeholder="Latitude"
              value={newLat}
              onChange={(e) => setNewLat(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
            />
            <input
              type="number"
              step="0.0001"
              placeholder="Longitude"
              value={newLng}
              onChange={(e) => setNewLng(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-orange focus:outline-none"
            />
            <button
              onClick={() => addPoint()}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-700 transition"
            >
              Add
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={savePolygon}
              disabled={saving || polygon.length < 3}
              className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold transition hover:bg-orange-dark disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Service Area"}
            </button>
            {saved && <span className="text-sm text-green-400">Saved!</span>}
            {polygon.length > 0 && (
              <button
                onClick={() => setPolygon([])}
                className="text-xs text-zinc-500 hover:text-red-400 transition"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          {API_KEY ? (
            <GoogleMapsProvider>
              <ServiceAreaMapPanel
                polygon={polygon}
                onMapClick={handleMapClick}
              />
            </GoogleMapsProvider>
          ) : (
            <MapPlaceholder pointCount={polygon.length} />
          )}
        </div>
      </div>
    </div>
  );
}
