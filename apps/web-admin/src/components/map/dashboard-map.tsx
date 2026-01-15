'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface Property {
  id: string;
  name: string;
  status: string;
  latitude: number;
  longitude: number;
  type?: string;
  source?: 'registered' | 'airbnb' | 'booking' | 'expedia' | 'other';
}

interface DashboardMapProps {
  properties: Property[];
}

// Platform colors and icons
const platformConfig: Record<string, { color: string; icon: string; label: string }> = {
  registered: { color: '#22c55e', icon: 'verified', label: 'Enregistrées' },
  airbnb: { color: '#FF5A5F', icon: 'home', label: 'Airbnb' },
  booking: { color: '#003580', icon: 'hotel', label: 'Booking' },
  expedia: { color: '#FFCC00', icon: 'luggage', label: 'Expedia' },
  expat_dakar: { color: '#00A650', icon: 'apartment', label: 'Expat Dakar' },
  mamaison: { color: '#FF6B00', icon: 'villa', label: 'MaMaison' },
  other: { color: '#6b7280', icon: 'location_on', label: 'Autres' },
};

export default function DashboardMap({ properties }: DashboardMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [visibleSources, setVisibleSources] = useState<Set<string>>(new Set(['registered', 'airbnb', 'booking', 'expedia', 'expat_dakar', 'mamaison', 'other']));

  // Count properties by source
  const sourceCounts = properties.reduce((acc, p) => {
    const source = p.source || 'other';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const toggleSource = (source: string) => {
    setVisibleSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

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

  // Add markers when properties or visibility changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current?.removeLayer(layer);
      }
    });

    // Filter and add property markers
    const visibleProperties = properties.filter(p => {
      const source = p.source || 'other';
      return visibleSources.has(source);
    });

    visibleProperties.forEach((property) => {
      if (property.latitude && property.longitude) {
        const source = property.source || 'other';
        const config = platformConfig[source] || platformConfig.other;

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              width: 28px;
              height: 28px;
              background: ${config.color};
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span class="material-symbols-outlined" style="color: white; font-size: 14px;">${config.icon}</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const tooltipContent = `
          <div style="font-weight: 600;">${property.name}</div>
          <div style="font-size: 11px; color: #666; margin-top: 2px;">
            ${config.label}${property.type && source !== 'registered' ? ` - ${property.type}` : ''}
          </div>
        `;

        L.marker([property.latitude, property.longitude], { icon })
          .bindTooltip(tooltipContent, { direction: 'top', offset: [0, -14] })
          .addTo(mapRef.current!);
      }
    });

    // Fit bounds if we have visible properties
    if (visibleProperties.length > 0) {
      const bounds = L.latLngBounds(
        visibleProperties
          .filter(p => p.latitude && p.longitude)
          .map(p => [p.latitude, p.longitude] as [number, number])
      );
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [properties, visibleSources]);

  // Get sources that have data
  const activeSources = Object.keys(sourceCounts).sort((a, b) => {
    // Put registered first, then sort by count
    if (a === 'registered') return -1;
    if (b === 'registered') return 1;
    return (sourceCounts[b] || 0) - (sourceCounts[a] || 0);
  });

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="absolute inset-0"
        style={{ background: '#e5e7eb' }}
      />

      {/* Legend */}
      <div className="absolute top-3 left-3 z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 max-w-[200px]">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">
          Sources ({properties.length})
        </div>
        <div className="space-y-1">
          {activeSources.map(source => {
            const config = platformConfig[source] || platformConfig.other;
            const count = sourceCounts[source] || 0;
            const isVisible = visibleSources.has(source);

            return (
              <button
                key={source}
                onClick={() => toggleSource(source)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-left transition-all ${
                  isVisible
                    ? 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                    : 'opacity-40 hover:opacity-60'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: config.color }}
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: '10px' }}>
                    {config.icon}
                  </span>
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                  {config.label}
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
