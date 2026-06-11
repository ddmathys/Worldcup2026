"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface VenuePin {
  id: string;
  city: string;
  stadium: string;
  country: "usa" | "canada" | "mexico";
  lat: number;
  lon: number;
  matches: number;
  capacity: number;
  special?: string;
}

const COLORS = {
  usa:    { main: "#3b82f6", glow: "59,130,246" },
  canada: { main: "#ef4444", glow: "239,68,68" },
  mexico: { main: "#10b981", glow: "16,185,129" },
};

const MAP_CSS = `
  .leaflet-container { background: #020b18 !important; font-family: system-ui; }
  .leaflet-tile-pane { filter: saturate(0.7) brightness(0.9); }
  .leaflet-control-zoom a {
    background: rgba(15,23,42,0.92) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    color: rgba(255,255,255,0.7) !important;
    width: 30px !important; height: 30px !important;
    line-height: 28px !important; font-size: 16px !important;
    transition: background 0.15s;
  }
  .leaflet-control-zoom a:hover { background: rgba(30,41,59,0.98) !important; color: white !important; }
  .leaflet-control-zoom { border: none !important; box-shadow: 0 2px 16px rgba(0,0,0,0.5) !important; border-radius: 8px !important; overflow: hidden; }
  .leaflet-control-attribution {
    background: rgba(2,11,24,0.75) !important; color: rgba(255,255,255,0.25) !important;
    font-size: 9px !important; border-radius: 4px 0 0 0 !important; padding: 2px 6px !important;
  }
  .leaflet-control-attribution a { color: rgba(255,255,255,0.4) !important; }
  .wc-tooltip {
    background: rgba(15,23,42,0.97) !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 10px !important;
    padding: 10px 14px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
    pointer-events: none;
  }
  .wc-tooltip::before { display: none !important; }
  .leaflet-tooltip-top.wc-tooltip::before { display: none !important; }
  @keyframes wc-pulse {
    0%   { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  @keyframes wc-pulse2 {
    0%   { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  .wc-ring1 { animation: wc-pulse  2s ease-out infinite; }
  .wc-ring2 { animation: wc-pulse2 2s ease-out infinite 0.7s; }
`;

function makeIcon(venue: VenuePin, selected: boolean) {
  const c = COLORS[venue.country];
  const isFinal   = venue.special === "Finale";
  const isSpecial = !!venue.special;
  const color     = isFinal ? "#fbbf24" : c.main;
  const glowRgb   = isFinal ? "251,191,36" : c.glow;
  const size      = selected ? 20 : isFinal ? 18 : isSpecial ? 15 : 11;
  const pulse     = isSpecial || selected;

  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      ${pulse ? `
        <div class="wc-ring1" style="position:absolute;inset:0;border-radius:50%;background:rgba(${glowRgb},0.35);"></div>
        <div class="wc-ring2" style="position:absolute;inset:0;border-radius:50%;background:rgba(${glowRgb},0.2);"></div>
      ` : ""}
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${selected ? "#fbbf24" : color};
        border:${selected ? "2.5px solid white" : "1.5px solid rgba(255,255,255,0.7)"};
        box-shadow:0 0 ${selected ? 16 : 8}px ${selected ? "#fbbf24" : color},
                   0 0 ${selected ? 32 : 16}px rgba(${selected ? "251,191,36" : glowRgb},0.4),
                   0 2px 8px rgba(0,0,0,0.6);
        position:relative;z-index:1;
      "></div>
    </div>`;

  return L.divIcon({
    className: "",
    html,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makeTooltip(venue: VenuePin) {
  const c = COLORS[venue.country];
  const isFinal = venue.special === "Finale";
  const color   = isFinal ? "#fbbf24" : c.main;
  return `
    <div>
      <p style="margin:0 0 2px;font-weight:800;font-size:13px;color:#f1f5f9;">${venue.city}</p>
      <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.45);">${venue.stadium}</p>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;font-weight:700;color:${color};">${venue.matches} matchs</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.3);">${venue.capacity.toLocaleString("fr-FR")} places</span>
      </div>
      ${venue.special ? `<p style="margin:4px 0 0;font-size:10px;color:#fbbf24;font-weight:600;">★ ${venue.special}</p>` : ""}
    </div>`;
}

/* Sub-component: syncs markers + handles flyTo */
function Markers({
  venues,
  selectedId,
  onSelect,
}: {
  venues: VenuePin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const markersRef = useRef<Record<string, L.Marker>>({});
  const prevSelected = useRef<string | null>(null);

  useEffect(() => {
    venues.forEach((v) => {
      const icon = makeIcon(v, false);
      const m = L.marker([v.lat, v.lon], {
        icon,
        zIndexOffset: v.special === "Finale" ? 1000 : v.special ? 500 : 0,
      }).addTo(map);

      m.bindTooltip(makeTooltip(v), {
        direction: "top",
        offset: L.point(0, -8),
        className: "wc-tooltip",
        opacity: 1,
        permanent: false,
      });

      m.on("click", () => {
        onSelect(v.id);
        map.flyTo([v.lat, v.lon], 6, { duration: 1.2, easeLinearity: 0.4 });
      });

      markersRef.current[v.id] = m;
    });

    return () => {
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Update marker icons when selection changes */
  useEffect(() => {
    const prev = prevSelected.current;
    if (prev && markersRef.current[prev]) {
      const v = venues.find((x) => x.id === prev)!;
      markersRef.current[prev].setIcon(makeIcon(v, false));
    }
    if (selectedId && markersRef.current[selectedId]) {
      const v = venues.find((x) => x.id === selectedId)!;
      markersRef.current[selectedId].setIcon(makeIcon(v, true));
      markersRef.current[selectedId].setZIndexOffset(2000);
    }
    prevSelected.current = selectedId;
  }, [selectedId, venues]);

  return null;
}

interface Props {
  venues: VenuePin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function VenueMap({ venues, selectedId, onSelect }: Props) {
  /* Inject CSS once */
  useEffect(() => {
    if (document.getElementById("wc-map-css")) return;
    const el = document.createElement("style");
    el.id = "wc-map-css";
    el.textContent = MAP_CSS;
    document.head.appendChild(el);
  }, []);

  return (
    <MapContainer
      center={[39, -97]}
      zoom={3}
      zoomControl
      attributionControl
      style={{ width: "100%", height: "100%" }}
      maxBounds={[[-10, -170], [72, -50]]}
      minZoom={2}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <Markers venues={venues} selectedId={selectedId} onSelect={onSelect} />
    </MapContainer>
  );
}
