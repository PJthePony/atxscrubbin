import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lat, lng } = body;

  if (lat === undefined || lng === undefined) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Get service area polygon
  const { data: areaData, error } = await supabase
    .from("service_area")
    .select("polygon")
    .limit(1)
    .single();

  if (error || !areaData?.polygon) {
    // No service area configured — allow all
    return NextResponse.json({ inArea: true });
  }

  const polygon = areaData.polygon as {
    type: string;
    coordinates: number[][][];
  };

  // Point-in-polygon test (ray casting)
  const ring = polygon.coordinates[0]; // outer ring
  const inArea = pointInPolygon(lat, lng, ring);

  return NextResponse.json({ inArea });
}

function pointInPolygon(
  lat: number,
  lng: number,
  ring: number[][]
): boolean {
  let inside = false;
  // ring is array of [lng, lat] pairs (GeoJSON convention)
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1]; // lat
    const yi = ring[i][0]; // lng
    const xj = ring[j][1];
    const yj = ring[j][0];

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}
