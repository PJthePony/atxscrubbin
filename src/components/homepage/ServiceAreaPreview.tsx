"use client";

import { useEffect, useState, useRef } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface ServicePolygon {
  type: string;
  coordinates: number[][][];
}

function PolygonOverlay({ paths }: { paths: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map) return;

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }

    polygonRef.current = new google.maps.Polygon({
      paths,
      fillColor: "#FFA000",
      fillOpacity: 0.15,
      strokeColor: "#FFA000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      map,
    });

    return () => {
      polygonRef.current?.setMap(null);
    };
  }, [map, paths]);

  return null;
}

function ServiceAreaMap() {
  const [polygon, setPolygon] = useState<google.maps.LatLngLiteral[] | null>(
    null
  );

  useEffect(() => {
    fetch("/api/service-area")
      .then((r) => r.json())
      .then((data) => {
        if (data?.polygon?.coordinates?.[0]) {
          const poly = data.polygon as ServicePolygon;
          setPolygon(
            poly.coordinates[0].map((c) => ({ lat: c[1], lng: c[0] }))
          );
        }
      })
      .catch(() => {});
  }, []);

  if (!polygon) {
    return (
      <div className="h-72 sm:h-80 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">📍</div>
          <p className="text-sm text-brown/50">Loading service area...</p>
        </div>
      </div>
    );
  }

  const lats = polygon.map((p) => p.lat);
  const lngs = polygon.map((p) => p.lng);
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };

  return (
    <div className="h-72 sm:h-96">
      <Map
        defaultCenter={center}
        defaultZoom={11}
        gestureHandling="cooperative"
        disableDefaultUI
        mapId="service-area-homepage"
        style={{ width: "100%", height: "100%" }}
      >
        <PolygonOverlay paths={polygon} />
      </Map>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="h-72 sm:h-80 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">📍</div>
        <p className="text-sm text-brown/50">Interactive map coming soon</p>
        <p className="text-xs text-brown/30 mt-1">
          Enter your address when you book to check if we cover your area
        </p>
      </div>
    </div>
  );
}

export default function ServiceAreaPreview() {
  return (
    <section id="area" className="px-6 py-24 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-3 text-brown-dark">
        Service Area
      </h2>
      <p className="text-center text-brown/60 mb-12 max-w-lg mx-auto">
        We&apos;re all over central Austin. If you&apos;re not sure, just try
        booking — we&apos;ll let you know.
      </p>
      <div className="rounded-2xl border-2 border-brown/15 bg-sand/50 overflow-hidden">
        {API_KEY ? (
          <GoogleMapsProvider>
            <ServiceAreaMap />
          </GoogleMapsProvider>
        ) : (
          <Placeholder />
        )}
      </div>
    </section>
  );
}
