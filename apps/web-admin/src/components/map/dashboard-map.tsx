'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface Property {
  id: string;
  name: string;
  status: string;
  latitude: number;
  longitude: number;
}

interface DashboardMapProps {
  properties: Property[];
}

export default function DashboardMap({ properties }: DashboardMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map centered on Dakar
    mapRef.current = L.map(mapContainerRef.current, {
      center: [14.6937, -17.4441],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Add markers when properties change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current?.removeLayer(layer);
      }
    });

    // Add property markers
    properties.forEach((property) => {
      if (property.latitude && property.longitude) {
        const color = property.status === 'active' ? '#22c55e' :
                      property.status === 'pending' ? '#eab308' : '#ef4444';

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background: ${color};
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        L.marker([property.latitude, property.longitude], { icon })
          .bindTooltip(property.name, { direction: 'top', offset: [0, -12] })
          .addTo(mapRef.current!);
      }
    });

    // Fit bounds if we have properties
    if (properties.length > 0) {
      const bounds = L.latLngBounds(
        properties
          .filter(p => p.latitude && p.longitude)
          .map(p => [p.latitude, p.longitude] as [number, number])
      );
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [properties]);

  return (
    <div
      ref={mapContainerRef}
      className="absolute inset-0"
      style={{ background: '#e5e7eb' }}
    />
  );
}
