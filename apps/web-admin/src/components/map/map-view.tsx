'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  region: string | null;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  registration_number: string | null;
  latitude: number | null;
  longitude: number | null;
  type: string;
  source?: 'properties' | 'hotels';
  landlords?: {
    first_name: string;
    last_name: string;
  };
}

interface Alert {
  id: string;
  title: string;
  type: string;
  severity: string;
  location_city: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface MapViewProps {
  properties: Property[];
  alerts: Alert[];
  selectedProperty: Property | null;
  onSelectProperty: (property: Property) => void;
}

// Custom marker icons
const createMarkerIcon = (color: string, isSelected: boolean = false) => {
  const size = isSelected ? 40 : 32;
  const shadowSize = isSelected ? 50 : 40;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        ${isSelected ? 'transform: scale(1.2); box-shadow: 0 0 0 4px rgba(19, 91, 236, 0.3), 0 2px 8px rgba(0,0,0,0.3);' : ''}
      ">
        <span class="material-symbols-outlined" style="color: white; font-size: ${size * 0.5}px;">hotel</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const alertIcon = L.divIcon({
  className: 'alert-marker',
  html: `
    <div style="
      width: 36px;
      height: 36px;
      background: #ef4444;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    ">
      <span class="material-symbols-outlined" style="color: white; font-size: 18px;">warning</span>
    </div>
    <style>
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
    </style>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export default function MapView({ properties, alerts, selectedProperty, onSelectProperty }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map centered on Dakar, Senegal
    mapRef.current = L.map(mapContainerRef.current, {
      center: [14.6937, -17.4441],
      zoom: 12,
      zoomControl: false,
    });

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Add zoom control to bottom right
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

  // Update markers when properties or selection changes
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    // Add property markers
    properties.forEach((property) => {
      if (property.latitude && property.longitude) {
        const isSelected = selectedProperty?.id === property.id;
        // Hotels from scraped_listings get orange color, properties get blue/yellow/gray based on status
        const color = property.source === 'hotels' ? '#f97316' :
                      property.status === 'active' ? '#135bec' :
                      property.status === 'pending' ? '#eab308' : '#6b7280';

        const marker = L.marker([property.latitude, property.longitude], {
          icon: createMarkerIcon(color, isSelected),
        });

        marker.on('click', () => {
          onSelectProperty(property);
        });

        marker.bindTooltip(property.name, {
          permanent: false,
          direction: 'top',
          offset: [0, -20],
        });

        markersRef.current?.addLayer(marker);
      }
    });

    // Add alert markers
    alerts.forEach((alert) => {
      if (alert.latitude && alert.longitude) {
        const marker = L.marker([alert.latitude, alert.longitude], {
          icon: alertIcon,
        });

        marker.bindTooltip(alert.title, {
          permanent: false,
          direction: 'top',
          offset: [0, -20],
        });

        markersRef.current?.addLayer(marker);
      }
    });
  }, [properties, alerts, selectedProperty, onSelectProperty]);

  // Pan to selected property
  useEffect(() => {
    if (mapRef.current && selectedProperty?.latitude && selectedProperty?.longitude) {
      mapRef.current.panTo([selectedProperty.latitude, selectedProperty.longitude], {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedProperty]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ background: '#e5e7eb' }}
    />
  );
}
