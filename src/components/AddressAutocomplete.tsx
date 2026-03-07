"use client";

import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Where should we come?",
  className = "",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary("places");
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const ac = new places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "geometry"],
      types: ["address"],
    });

    // Bias toward Austin
    const austinBounds = new google.maps.LatLngBounds(
      { lat: 30.1, lng: -97.95 },
      { lat: 30.55, lng: -97.55 }
    );
    ac.setBounds(austinBounds);

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place.geometry?.location && place.formatted_address) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onSelect(place.formatted_address, lat, lng);
      }
    });

    setAutocomplete(ac);

    return () => {
      google.maps.event.clearInstanceListeners(ac);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  // Keep the autocomplete reference alive but don't re-create it
  void autocomplete;

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}
