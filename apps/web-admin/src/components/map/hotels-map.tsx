'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Hotel {
  id: string;
  platform_id?: string;
  title: string;
  city: string;
  location_text?: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  num_reviews: number | null;
  url?: string;
  photos?: string[];
  raw_data?: {
    phone?: string | null;
    website?: string | null;
    property_type?: string | null;
    price_level?: number | null;
    business_status?: string | null;
  } | null;
  created_at?: string;
  last_seen_at?: string;
}

interface HotelsMapProps {
  hotels: Hotel[];
  selectedHotel: Hotel | null;
  onSelectHotel: (hotel: Hotel) => void;
}

const createHotelIcon = (type: string, isSelected: boolean = false, hasPhone: boolean = false) => {
  const size = isSelected ? 36 : 28;
  const color = hasPhone ? '#16a34a' : '#3b82f6'; // Green if has phone, blue otherwise
  const icon = type === 'Auberge' ? 'cottage' : 'apartment';

  return L.divIcon({
    className: 'hotel-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        ${isSelected ? 'transform: scale(1.2); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4), 0 2px 6px rgba(0,0,0,0.3);' : ''}
      ">
        <span class="material-symbols-outlined" style="color: white; font-size: ${size * 0.5}px;">${icon}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export default function HotelsMap({ hotels, selectedHotel, onSelectHotel }: HotelsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map centered on Senegal
    mapRef.current = L.map(mapContainerRef.current, {
      center: [14.5, -14.5], // Center of Senegal
      zoom: 7,
      zoomControl: false,
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Add zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    // Initialize markers layer group
    markersRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when hotels change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    const bounds: L.LatLngBoundsExpression = [];

    hotels.forEach((hotel) => {
      if (hotel.latitude && hotel.longitude) {
        const isSelected = selectedHotel?.id === hotel.id;
        const hasPhone = !!hotel.raw_data?.phone;
        const type = hotel.raw_data?.property_type || 'Hotel';

        const marker = L.marker([hotel.latitude, hotel.longitude], {
          icon: createHotelIcon(type, isSelected, hasPhone),
        });

        marker.on('click', () => {
          onSelectHotel(hotel);
        });

        // Tooltip with hotel info
        const tooltipContent = `
          <div style="min-width: 150px;">
            <strong>${hotel.title}</strong><br/>
            <span style="color: #666;">${hotel.city}</span>
            ${hotel.rating ? `<br/><span style="color: #eab308;">★</span> ${hotel.rating.toFixed(1)}` : ''}
            ${hasPhone ? `<br/><span style="color: #16a34a;">📞 ${hotel.raw_data?.phone}</span>` : ''}
          </div>
        `;

        marker.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'top',
          offset: [0, -15],
        });

        markersRef.current?.addLayer(marker);
        bounds.push([hotel.latitude, hotel.longitude]);
      }
    });

    // Fit bounds if we have markers
    if (bounds.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(bounds as L.LatLngBoundsExpression, {
        padding: [50, 50],
        maxZoom: 12,
      });
    }
  }, [hotels, selectedHotel, onSelectHotel]);

  // Pan to selected hotel
  useEffect(() => {
    if (mapRef.current && selectedHotel?.latitude && selectedHotel?.longitude) {
      mapRef.current.setView([selectedHotel.latitude, selectedHotel.longitude], 14, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedHotel]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ background: '#e5e7eb', minHeight: '400px' }}
      />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs z-[1000]">
        <div className="font-semibold mb-2">Légende</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 rounded-full bg-green-600"></div>
          <span>Avec téléphone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span>Sans téléphone</span>
        </div>
      </div>
    </div>
  );
}
