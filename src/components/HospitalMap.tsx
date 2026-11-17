import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { HospitalFacility } from '../types';

interface HospitalMapProps {
  center: { lat: number; lon: number };
  facilities: HospitalFacility[];
  selectedId: string | null;
  onSelectFacility: (facility: HospitalFacility) => void;
}

export function HospitalMap({ center, facilities, selectedId, onSelectFacility }: HospitalMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lon],
      zoom: 13,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    map.setView([center.lat, center.lon], 13, { animate: true });

    const userMarker = L.circleMarker([center.lat, center.lon], {
      radius: 9,
      fillColor: '#0F2942',
      color: '#FFFFFF',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    }).bindPopup('<strong>Search Center</strong>');
    userMarker.addTo(group);

    facilities.forEach((facility) => {
      const isSelected = facility.id === selectedId;
      const marker = L.circleMarker([facility.lat, facility.lon], {
        radius: isSelected ? 10 : 7,
        fillColor: facility.facilityType === 'Hospital' ? '#0D9488' : '#2563EB',
        color: isSelected ? '#0F2942' : '#FFFFFF',
        weight: isSelected ? 3 : 2,
        opacity: 1,
        fillOpacity: 0.92,
      });

      const addressLine = facility.address || 'Address not listed in OpenStreetMap';
      const phoneLine = facility.phone ? `<br/>Phone: ${facility.phone}` : '';
      marker.bindPopup(
        `<div style="min-width:180px"><strong>${facility.name}</strong><br/><span style="color:#475569;font-size:12px">${facility.facilityType} &middot; ${facility.distanceKm} km</span><br/><span style="font-size:12px">${addressLine}${phoneLine}</span></div>`
      );
      marker.on('click', () => onSelectFacility(facility));
      marker.addTo(group);
      if (isSelected) {
        marker.openPopup();
        map.panTo([facility.lat, facility.lon]);
      }
    });
  }, [center, facilities, selectedId, onSelectFacility]);

  return (
    <div
      ref={containerRef}
      className="h-[380px] w-full rounded-lg border border-slate-200 bg-slate-100 overflow-hidden"
      aria-label="Interactive map of nearby hospitals and clinics"
    />
  );
}
