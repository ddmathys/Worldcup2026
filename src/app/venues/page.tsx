"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navigation from "@/components/Navigation";
import { MapPin, Users, Star, X, Calendar, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { subscribeMatches } from "@/lib/firestore";
import type { Match } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import FlagImage from "@/components/FlagImage";

interface Venue {
  id: string;
  city: string;
  country: "usa" | "canada" | "mexico";
  stadium: string;
  capacity: number;
  matches: number;
  lat: number;
  lon: number;
  special?: string;
}

const VENUES: Venue[] = [
  // Mexico
  { id: "mex", city: "Mexico", country: "mexico", stadium: "Estadio Azteca", capacity: 87523, matches: 4, lat: 19.3, lon: -99.2, special: "Match d'ouverture" },
  { id: "gdl", city: "Guadalajara", country: "mexico", stadium: "Estadio Akron", capacity: 49850, matches: 4, lat: 20.7, lon: -103.5 },
  { id: "mty", city: "Monterrey", country: "mexico", stadium: "Estadio BBVA", capacity: 51228, matches: 4, lat: 25.7, lon: -100.3 },
  // USA
  { id: "nyc", city: "New York / New Jersey", country: "usa", stadium: "MetLife Stadium", capacity: 82500, matches: 8, lat: 40.8, lon: -74.1, special: "Finale" },
  { id: "lax", city: "Los Angeles", country: "usa", stadium: "SoFi Stadium", capacity: 70240, matches: 8, lat: 33.9, lon: -118.3 },
  { id: "dal", city: "Dallas", country: "usa", stadium: "AT&T Stadium", capacity: 80000, matches: 7, lat: 32.7, lon: -97.1 },
  { id: "hou", city: "Houston", country: "usa", stadium: "NRG Stadium", capacity: 72220, matches: 6, lat: 29.7, lon: -95.4 },
  { id: "atl", city: "Atlanta", country: "usa", stadium: "Mercedes-Benz Stadium", capacity: 71000, matches: 6, lat: 33.8, lon: -84.4 },
  { id: "sfo", city: "San Francisco", country: "usa", stadium: "Levi's Stadium", capacity: 68500, matches: 6, lat: 37.4, lon: -122.0 },
  { id: "sea", city: "Seattle", country: "usa", stadium: "Lumen Field", capacity: 68000, matches: 6, lat: 47.6, lon: -122.3 },
  { id: "ksc", city: "Kansas City", country: "usa", stadium: "Arrowhead Stadium", capacity: 76416, matches: 6, lat: 39.1, lon: -94.5 },
  { id: "phi", city: "Philadelphie", country: "usa", stadium: "Lincoln Financial Field", capacity: 69796, matches: 7, lat: 39.9, lon: -75.2 },
  { id: "mia", city: "Miami", country: "usa", stadium: "Hard Rock Stadium", capacity: 64767, matches: 7, lat: 25.9, lon: -80.2 },
  { id: "bos", city: "Boston", country: "usa", stadium: "Gillette Stadium", capacity: 65878, matches: 6, lat: 42.1, lon: -71.3 },
  // Canada
  { id: "tor", city: "Toronto", country: "canada", stadium: "BMO Field", capacity: 45736, matches: 7, lat: 43.6, lon: -79.4 },
  { id: "van", city: "Vancouver", country: "canada", stadium: "BC Place", capacity: 54500, matches: 7, lat: 49.3, lon: -123.1 },
];

const COUNTRY_CONFIG = {
  usa: { label: "États-Unis", flag: "🇺🇸", color: "blue", accent: "from-blue-500/20 to-blue-600/10", border: "border-blue-500/20", badge: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  canada: { label: "Canada", flag: "🇨🇦", color: "red", accent: "from-red-500/20 to-red-600/10", border: "border-red-500/20", badge: "bg-red-500/15 text-red-400 border-red-500/25" },
  mexico: { label: "Mexique", flag: "🇲🇽", color: "green", accent: "from-emerald-500/20 to-emerald-600/10", border: "border-emerald-500/20", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
};

const LON_MIN = -130, LON_RANGE = 67;
const LAT_MAX = 57, LAT_RANGE = 43;

function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon - LON_MIN) / LON_RANGE) * 100,
    y: ((LAT_MAX - lat) / LAT_RANGE) * 100,
  };
}

function getVenueMatches(venue: Venue, matches: Match[]): Match[] {
  return matches
    .filter((m) => {
      const stadiumMatch = m.stadiumName?.toLowerCase() === venue.stadium.toLowerCase();
      const cityMain = venue.city.split("/")[0].trim().toLowerCase();
      const cityMatch = m.city?.toLowerCase().includes(cityMain);
      return stadiumMatch || cityMatch;
    })
    .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime());
}

const PHASE_LABELS: Record<string, string> = {
  group: "Poule", r32: "32es de finale", r16: "16es de finale",
  qf: "Quart de finale", sf: "Demi-finale", final: "Finale",
};

type Filter = "all" | "usa" | "canada" | "mexico";

export default function VenuesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [hoveredVenue, setHoveredVenue] = useState<string | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);

  useEffect(() => {
    const unsub = subscribeMatches((m) => setAllMatches(m));
    return unsub;
  }, []);

  const filtered = filter === "all" ? VENUES : VENUES.filter((v) => v.country === filter);
  const totalMatches = VENUES.reduce((s, v) => s + v.matches, 0);
  const totalCapacity = Math.max(...VENUES.map((v) => v.capacity));

  const selectedVenue = selectedVenueId ? VENUES.find((v) => v.id === selectedVenueId) ?? null : null;
  const venueMatches = selectedVenue ? getVenueMatches(selectedVenue, allMatches) : [];

  function handleVenueClick(id: string) {
    setSelectedVenueId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-4xl font-black text-white mb-2">
            Stades <span className="text-gold">&amp; Villes</span>
          </h1>
          <p className="text-white/50 text-sm">
            {VENUES.length} stades · {totalMatches} matchs · 3 pays hôtes
          </p>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {(["mexico", "usa", "canada"] as const).map((c, i) => {
            const cfg = COUNTRY_CONFIG[c];
            const count = VENUES.filter((v) => v.country === c).length;
            const mcount = VENUES.filter((v) => v.country === c).reduce((s, v) => s + v.matches, 0);
            return (
              <motion.button
                key={c}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setFilter(filter === c ? "all" : c)}
                className={clsx(
                  "glass rounded-2xl p-4 text-center transition-all duration-200",
                  filter === c ? `border ${cfg.border} bg-gradient-to-b ${cfg.accent}` : "hover:bg-white/8"
                )}
              >
                <div className="text-3xl mb-1">{cfg.flag}</div>
                <div className="font-black text-white text-lg">{count} stades</div>
                <div className="text-xs text-white/40">{mcount} matchs · {cfg.label}</div>
              </motion.button>
            );
          })}
        </div>

        {/* MAP */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-3xl overflow-hidden mb-8 border border-white/10"
        >
          <div className="relative w-full" style={{ paddingBottom: "52%" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#061020] to-[#030c18]" />
            <div className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)",
                backgroundSize: "28px 28px",
              }}
            />

            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 900 468" preserveAspectRatio="xMidYMid meet">
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Canada */}
              <path d="M 70,18 L 860,18 L 875,50 L 875,130 L 820,128 L 750,125 L 685,128 L 640,132 L 600,130 L 560,130 L 490,128 L 420,128 L 360,132 L 290,135 L 230,138 L 165,140 L 103,143 L 70,135 Z"
                fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.3)" strokeWidth="1.2" />
              {/* USA */}
              <path d="M 70,135 L 103,143 L 165,140 L 230,138 L 290,135 L 360,132 L 420,128 L 490,128 L 560,130 L 600,130 L 640,132 L 685,128 L 750,125 L 820,128 L 875,130 L 880,170 L 875,210 L 865,240 L 850,265 L 820,275 L 790,272 L 760,268 L 730,272 L 710,278 L 685,285 L 660,288 L 635,280 L 610,282 L 595,290 L 580,285 L 555,295 L 520,300 L 480,305 L 455,310 L 440,325 L 450,340 L 460,360 L 455,378 L 435,388 L 410,378 L 385,368 L 360,358 L 340,358 L 310,350 L 285,345 L 260,348 L 240,360 L 220,370 L 200,370 L 175,360 L 155,345 L 135,325 L 115,305 L 90,280 L 72,250 L 68,215 L 68,175 Z"
                fill="rgba(59,130,246,0.12)" stroke="rgba(59,130,246,0.3)" strokeWidth="1.2" />
              {/* Mexico */}
              <path d="M 155,345 L 175,360 L 200,370 L 220,370 L 240,360 L 260,348 L 285,345 L 310,350 L 335,355 L 360,358 L 380,368 L 395,375 L 405,390 L 395,410 L 375,430 L 350,448 L 318,460 L 290,462 L 268,455 L 250,440 L 235,420 L 220,402 L 198,388 L 175,378 L 155,360 Z"
                fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.3)" strokeWidth="1.2" />

              <line x1="380" y1="410" x2="460" y2="330" stroke="rgba(255,215,0,0.06)" strokeWidth="1" strokeDasharray="4,4" />
              <line x1="650" y1="140" x2="750" y2="148" stroke="rgba(255,215,0,0.06)" strokeWidth="1" strokeDasharray="4,4" />

              {/* City markers */}
              {VENUES.map((venue) => {
                const pos = project(venue.lat, venue.lon);
                const px = (pos.x / 100) * 900;
                const py = (pos.y / 100) * 468;
                const isHovered = hoveredVenue === venue.id;
                const isSelected = selectedVenueId === venue.id;
                const isFiltered = filter !== "all" && filter !== venue.country;
                const dotColor = venue.country === "usa" ? "#3b82f6" : venue.country === "canada" ? "#ef4444" : "#10b981";

                return (
                  <g
                    key={venue.id}
                    transform={`translate(${px}, ${py})`}
                    style={{ cursor: "pointer", opacity: isFiltered ? 0.2 : 1, transition: "opacity 0.3s" }}
                    onMouseEnter={() => setHoveredVenue(venue.id)}
                    onMouseLeave={() => setHoveredVenue(null)}
                    onClick={() => handleVenueClick(venue.id)}
                  >
                    {venue.special && (
                      <circle r="14" fill="none" stroke={dotColor} strokeWidth="1.5" opacity="0.4">
                        <animate attributeName="r" values="8;18;8" dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {isSelected && (
                      <circle r="16" fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.8" />
                    )}
                    <circle
                      r={isHovered || isSelected ? 8 : 6}
                      fill={isSelected ? "#fbbf24" : dotColor}
                      opacity={isHovered || isSelected ? 1 : 0.85}
                      filter={isHovered || isSelected ? "url(#glow)" : undefined}
                      style={{ transition: "r 0.15s" }}
                    />
                    <circle r="3" fill="white" opacity="0.9" />

                    {(isHovered || isSelected || (venue.special && !isFiltered)) && (
                      <g>
                        <rect
                          x="10" y="-14"
                          width={venue.city.length * 7 + 12}
                          height="20"
                          rx="5"
                          fill="#0f172a"
                          stroke={isSelected ? "#fbbf24" : dotColor}
                          strokeWidth="1"
                          opacity="0.95"
                        />
                        <text x="16" y="-1" fontSize="10" fill="white" fontWeight="600">
                          {venue.city}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Country legend */}
            <div className="absolute bottom-3 left-3 flex items-center gap-3">
              {(["mexico", "usa", "canada"] as const).map((c) => (
                <div key={c} className="flex items-center gap-1.5">
                  <div className={clsx("w-2.5 h-2.5 rounded-full", c === "usa" ? "bg-blue-500" : c === "canada" ? "bg-red-500" : "bg-emerald-500")} />
                  <span className="text-[10px] text-white/50">{COUNTRY_CONFIG[c].label}</span>
                </div>
              ))}
            </div>

            {/* Hover info (non-selected) */}
            {hoveredVenue && hoveredVenue !== selectedVenueId && (() => {
              const v = VENUES.find((x) => x.id === hoveredVenue)!;
              const cfg = COUNTRY_CONFIG[v.country];
              return (
                <div className="absolute top-3 right-3 glass rounded-xl px-3 py-2 border border-white/15 pointer-events-none">
                  <p className="font-bold text-white text-sm">{v.city}</p>
                  <p className="text-xs text-white/50">{v.stadium}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="text-white/40">{v.capacity.toLocaleString()} places</span>
                    <span className={clsx("px-1.5 py-0.5 rounded-full border font-semibold", cfg.badge)}>{v.matches} matchs</span>
                  </div>
                  {v.special && <p className="text-[10px] text-yellow-400 mt-1 flex items-center gap-1"><Star size={9} /> {v.special}</p>}
                  <p className="text-[10px] text-white/30 mt-1">Cliquez pour voir les matchs</p>
                </div>
              );
            })()}
          </div>
        </motion.div>

        {/* Match panel for selected venue */}
        <AnimatePresence>
          {selectedVenue && (
            <motion.div
              key="match-panel"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className={clsx(
                "glass rounded-2xl overflow-hidden mb-6 border",
                COUNTRY_CONFIG[selectedVenue.country].border
              )}
            >
              {/* Panel header */}
              <div className={clsx("flex items-center justify-between px-5 py-4 border-b border-white/8 bg-gradient-to-r", COUNTRY_CONFIG[selectedVenue.country].accent)}>
                <div className="flex items-center gap-3">
                  <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center",
                    selectedVenue.country === "usa" ? "bg-blue-500/20"
                    : selectedVenue.country === "canada" ? "bg-red-500/20"
                    : "bg-emerald-500/20"
                  )}>
                    <MapPin size={16} className={
                      selectedVenue.country === "usa" ? "text-blue-400"
                      : selectedVenue.country === "canada" ? "text-red-400"
                      : "text-emerald-400"
                    } />
                  </div>
                  <div>
                    <p className="font-black text-white">{selectedVenue.city}</p>
                    <p className="text-xs text-white/50">{selectedVenue.stadium}</p>
                  </div>
                  {selectedVenue.special && (
                    <span className="ml-2 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Star size={9} /> {selectedVenue.special}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedVenueId(null)}
                  className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
                >
                  <X size={14} className="text-white/60" />
                </button>
              </div>

              {/* Match list */}
              {venueMatches.length === 0 ? (
                <div className="py-10 text-center text-white/30 text-sm flex flex-col items-center gap-2">
                  <Calendar size={24} className="opacity-40" />
                  Aucun match chargé pour ce stade
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {venueMatches.map((match) => (
                    <div key={match.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/4 transition-colors">
                      {/* Date */}
                      <div className="w-24 flex-shrink-0">
                        <p className="text-xs font-semibold text-white/70">
                          {format(match.kickoffUtc, "d MMM", { locale: fr })}
                        </p>
                        <p className="text-xs text-white/40">
                          {format(match.kickoffUtc, "HH:mm", { locale: fr })}
                        </p>
                      </div>

                      {/* Phase badge */}
                      {match.groupCode ? (
                        <span className="hidden sm:block text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/8 text-white/40 flex-shrink-0">
                          Gr. {match.groupCode}
                        </span>
                      ) : (
                        <span className="hidden sm:block text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 flex-shrink-0">
                          {PHASE_LABELS[match.phase] ?? match.phase}
                        </span>
                      )}

                      {/* Teams */}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <FlagImage code={match.homeTeam.code} name={match.homeTeam.name} size={20} />
                        <span className="text-sm font-semibold text-white truncate">{match.homeTeam.name}</span>
                      </div>

                      {/* Score / time */}
                      <div className="flex-shrink-0 text-center w-16">
                        {match.isFinished ? (
                          <span className="text-sm font-black text-white">
                            {match.homeScore} – {match.awayScore}
                          </span>
                        ) : match.status === "live" ? (
                          <span className="text-xs font-bold text-emerald-400 animate-pulse">EN JEU</span>
                        ) : (
                          <ChevronRight size={14} className="text-white/20 mx-auto" />
                        )}
                      </div>

                      <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
                        <span className="text-sm font-semibold text-white truncate text-right">{match.awayTeam.name}</span>
                        <FlagImage code={match.awayTeam.code} name={match.awayTeam.name} size={20} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: "all" as Filter, label: "Tous les stades" },
            { key: "mexico" as Filter, label: "🇲🇽 Mexique" },
            { key: "usa" as Filter, label: "🇺🇸 États-Unis" },
            { key: "canada" as Filter, label: "🇨🇦 Canada" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={clsx(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                filter === key ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30" : "glass text-white/50 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Venue cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((venue, i) => {
            const cfg = COUNTRY_CONFIG[venue.country];
            const capacityPct = (venue.capacity / totalCapacity) * 100;
            const isSelected = selectedVenueId === venue.id;
            return (
              <motion.button
                key={venue.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleVenueClick(venue.id)}
                className={clsx(
                  "glass rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl w-full",
                  isSelected ? `border ${cfg.border} bg-gradient-to-b ${cfg.accent}` : venue.special ? `border ${cfg.border}` : "border border-transparent"
                )}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <MapPin size={12} className={isSelected ? "text-yellow-400" : "text-white/40"} />
                      <span className="font-black text-white text-base leading-tight">{venue.city}</span>
                    </div>
                    <p className="text-xs text-white/40">{venue.stadium}</p>
                  </div>
                  <span className={clsx("text-xs font-bold px-2 py-1 rounded-full border", cfg.badge)}>
                    {venue.matches} matchs
                  </span>
                </div>

                {venue.special && (
                  <div className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-2 py-1 mb-3">
                    <Star size={10} />
                    {venue.special}
                  </div>
                )}

                {/* Capacity bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-white/35 flex items-center gap-1">
                      <Users size={9} /> Capacité
                    </span>
                    <span className="text-xs font-bold text-white/60">
                      {venue.capacity.toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${capacityPct}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }}
                      className={clsx(
                        "h-full rounded-full bg-gradient-to-r",
                        venue.country === "usa" ? "from-blue-500 to-blue-400"
                          : venue.country === "canada" ? "from-red-500 to-red-400"
                          : "from-emerald-500 to-emerald-400"
                      )}
                    />
                  </div>
                </div>

                {isSelected && (
                  <p className="text-[10px] text-yellow-400/70 mt-2 flex items-center gap-1">
                    <Calendar size={9} />
                    Voir les matchs ↑
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
