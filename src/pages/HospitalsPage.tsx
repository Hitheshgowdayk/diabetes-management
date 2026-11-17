import { useState, type FormEvent } from 'react';
import { Crosshair, ExternalLink, MapPin, Phone, Search } from 'lucide-react';
import { HospitalMap } from '../components/HospitalMap';
import { apiRequest } from '../lib/api';
import type { HospitalFacility } from '../types';

export function HospitalsPage() {
  const [center, setCenter] = useState<{ lat: number; lon: number; displayName?: string }>({
    lat: 28.6139,
    lon: 77.209,
    displayName: 'Default Reference View (Use GPS or search your area)',
  });
  const [facilities, setFacilities] = useState<HospitalFacility[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function locateByGps() {
    setError(null);
    setStatusMessage(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Please use manual location search below.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const data = await apiRequest<{
            center: { lat: number; lon: number };
            facilities: HospitalFacility[];
          }>(`/api/hospitals/nearby?lat=${lat}&lon=${lon}&radius=${radius}`);

          setCenter({ lat: data.center.lat, lon: data.center.lon, displayName: 'Your Current Location' });
          setFacilities(data.facilities);
          setSelectedId(data.facilities[0]?.id ?? null);
          setHasSearched(true);
          setStatusMessage(`Found ${data.facilities.length} verified healthcare facilities within ${radius / 1000} km.`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to fetch nearby hospitals.');
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        setLoading(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setError('Location permission was denied. Please enter your city, area, or postal code manually below.');
        } else {
          setError('Unable to determine your GPS location. Please search manually by city or area.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleManualSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setError('Please enter a city, locality, or postal code.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const data = await apiRequest<{
        center: { lat: number; lon: number; displayName?: string };
        facilities: HospitalFacility[];
      }>(`/api/hospitals/search?q=${encodeURIComponent(q)}&radius=${radius}`);

      setCenter(data.center);
      setFacilities(data.facilities);
      setSelectedId(data.facilities[0]?.id ?? null);
      setHasSearched(true);
      setStatusMessage(
        `Showing ${data.facilities.length} OpenStreetMap healthcare facilities near ${data.center.displayName || q}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location search failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Nearby Hospital &amp; Clinic Finder</h1>
        <p className="mt-1 text-sm text-slate-600">
          Locate real hospitals and clinics using browser location access or manual area search via OpenStreetMap.
        </p>
      </div>

      {/* Location Request + Manual Fallback Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={locateByGps}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173B5E] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Crosshair className="h-4 w-4" />
            <span>{loading ? 'Searching...' : 'Use My Current Location'}</span>
          </button>

          <form onSubmit={handleManualSearch} className="flex-1 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Manual search: city, neighborhood, or PIN code (e.g., Bengaluru, Indiranagar)"
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-label="Search radius"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-[#0D9488] focus:outline-none"
            >
              <option value={3000}>Within 3 km</option>
              <option value={5000}>Within 5 km</option>
              <option value={10000}>Within 10 km</option>
              <option value={15000}>Within 15 km</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              Search Area
            </button>
          </form>
        </div>

        {statusMessage && (
          <p className="text-xs font-medium text-[#0F766E]">{statusMessage}</p>
        )}

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Interactive Map + Verified Facility List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-bold text-[#0F172A]">Interactive Facility Map</h2>
            <span className="text-xs text-slate-500 truncate max-w-xs">{center.displayName}</span>
          </div>
          <HospitalMap
            center={center}
            facilities={facilities}
            selectedId={selectedId}
            onSelectFacility={(f) => setSelectedId(f.id)}
          />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-[#0F172A]">Verified Healthcare Facilities</h2>
            <span className="text-xs font-mono-tabular text-slate-500">{facilities.length} listed</span>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto max-h-[360px] space-y-3 pr-1">
            {!hasSearched ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                <MapPin className="h-6 w-6 text-slate-400 mx-auto" />
                <p className="mt-2 text-sm font-medium text-slate-700">Ready to search nearby care centers</p>
                <p className="mt-1 text-xs text-slate-500">
                  Allow location access or type a city/area above to retrieve hospitals and clinics from OpenStreetMap.
                </p>
              </div>
            ) : facilities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">No hospitals or clinics found in this radius.</p>
                <p className="mt-1 text-xs text-slate-500">Try expanding the search radius to 10 km or 15 km.</p>
              </div>
            ) : (
              facilities.map((facility) => {
                const isSelected = facility.id === selectedId;
                return (
                  <div
                    key={facility.id}
                    onClick={() => setSelectedId(facility.id)}
                    className={`cursor-pointer rounded-lg border p-3.5 transition-colors ${
                      isSelected
                        ? 'border-[#0D9488] bg-[#F0FDFA]/60'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{facility.name}</h3>
                      <span className="text-xs font-mono-tabular font-semibold text-[#0F2942] whitespace-nowrap">
                        {facility.distanceKm} km
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {facility.facilityType}
                      {facility.emergency ? ' · Emergency Unit Marked' : ''}
                    </p>

                    <p className="mt-1.5 text-xs text-slate-700">
                      {facility.address || 'Street address not listed in OpenStreetMap'}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      {facility.phone ? (
                        <a
                          href={`tel:${facility.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#0D9488] hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{facility.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">Phone number not listed</span>
                      )}

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-semibold text-[#0F2942] hover:underline"
                      >
                        <span>Directions</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Data Source Notice: Facility names, coordinates, addresses, and phone numbers are fetched live from OpenStreetMap
        contributors via Overpass &amp; Nominatim. Fields missing from OpenStreetMap are marked as unavailable and never
        estimated.
      </p>
    </div>
  );
}
