"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import Navigation from "@/components/Navigation";
import { MapPin, Users, Star, X, Calendar, ChevronRight, Wind, Layers } from "lucide-react";
import clsx from "clsx";
import { subscribeMatches } from "@/lib/firestore";
import type { Match } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import FlagImage from "@/components/FlagImage";

const VenueMap = dynamic(() => import("@/components/VenueMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
    </div>
  ),
});

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
  roof: "ouvert" | "rétractable" | "dôme";
  surface: "gazon naturel" | "gazon hybride" | "synthétique";
  host?: string;
}

const VENUES: Venue[] = [
  { id: "mex", city: "Mexico", country: "mexico", stadium: "Estadio Azteca", capacity: 87523, matches: 4, lat: 19.3, lon: -99.2, special: "Match d'ouverture", roof: "ouvert", surface: "gazon naturel", host: "Club América" },
  { id: "gdl", city: "Guadalajara", country: "mexico", stadium: "Estadio Akron", capacity: 49850, matches: 4, lat: 20.7, lon: -103.5, roof: "ouvert", surface: "gazon naturel", host: "Chivas" },
  { id: "mty", city: "Monterrey", country: "mexico", stadium: "Estadio BBVA", capacity: 51228, matches: 4, lat: 25.7, lon: -100.3, roof: "ouvert", surface: "gazon naturel", host: "CF Monterrey" },
  { id: "nyc", city: "New York / New Jersey", country: "usa", stadium: "MetLife Stadium", capacity: 82500, matches: 8, lat: 40.8, lon: -74.1, special: "Finale", roof: "ouvert", surface: "gazon hybride", host: "Giants / Jets" },
  { id: "lax", city: "Los Angeles", country: "usa", stadium: "SoFi Stadium", capacity: 70240, matches: 8, lat: 33.9, lon: -118.3, roof: "rétractable", surface: "gazon hybride", host: "Rams / Chargers" },
  { id: "dal", city: "Dallas", country: "usa", stadium: "AT&T Stadium", capacity: 80000, matches: 7, lat: 32.7, lon: -97.1, roof: "rétractable", surface: "gazon naturel", host: "Cowboys" },
  { id: "hou", city: "Houston", country: "usa", stadium: "NRG Stadium", capacity: 72220, matches: 6, lat: 29.7, lon: -95.4, roof: "rétractable", surface: "gazon naturel", host: "Texans" },
  { id: "atl", city: "Atlanta", country: "usa", stadium: "Mercedes-Benz Stadium", capacity: 71000, matches: 6, lat: 33.8, lon: -84.4, roof: "rétractable", surface: "gazon hybride", host: "Falcons / Atlanta United" },
  { id: "sfo", city: "San Francisco", country: "usa", stadium: "Levi's Stadium", capacity: 68500, matches: 6, lat: 37.4, lon: -122.0, roof: "ouvert", surface: "gazon naturel", host: "49ers" },
  { id: "sea", city: "Seattle", country: "usa", stadium: "Lumen Field", capacity: 68000, matches: 6, lat: 47.6, lon: -122.3, roof: "ouvert", surface: "synthétique", host: "Seahawks / Sounders" },
  { id: "ksc", city: "Kansas City", country: "usa", stadium: "Arrowhead Stadium", capacity: 76416, matches: 6, lat: 39.1, lon: -94.5, roof: "ouvert", surface: "gazon naturel", host: "Chiefs" },
  { id: "phi", city: "Philadelphie", country: "usa", stadium: "Lincoln Financial Field", capacity: 69796, matches: 7, lat: 39.9, lon: -75.2, roof: "ouvert", surface: "gazon naturel", host: "Eagles" },
  { id: "mia", city: "Miami", country: "usa", stadium: "Hard Rock Stadium", capacity: 64767, matches: 7, lat: 25.9, lon: -80.2, roof: "rétractable", surface: "gazon naturel", host: "Dolphins" },
  { id: "bos", city: "Boston", country: "usa", stadium: "Gillette Stadium", capacity: 65878, matches: 6, lat: 42.1, lon: -71.3, roof: "ouvert", surface: "gazon naturel", host: "Patriots / Revolution" },
  { id: "tor", city: "Toronto", country: "canada", stadium: "BMO Field", capacity: 45736, matches: 7, lat: 43.6, lon: -79.4, roof: "ouvert", surface: "gazon hybride", host: "Toronto FC" },
  { id: "van", city: "Vancouver", country: "canada", stadium: "BC Place", capacity: 54500, matches: 7, lat: 49.3, lon: -123.1, roof: "rétractable", surface: "synthétique", host: "Whitecaps" },
];

const COUNTRY_CONFIG = {
  usa: { label: "États-Unis", flag: "🇺🇸", accent: "from-blue-500/20 to-blue-600/10", border: "border-blue-500/20", badge: "bg-blue-500/15 text-blue-400 border-blue-500/25", dot: "bg-blue-500", pitchFrom: "from-blue-900", pitchTo: "to-blue-800" },
  canada: { label: "Canada", flag: "🇨🇦", accent: "from-red-500/20 to-red-600/10", border: "border-red-500/20", badge: "bg-red-500/15 text-red-400 border-red-500/25", dot: "bg-red-500", pitchFrom: "from-red-900", pitchTo: "to-red-800" },
  mexico: { label: "Mexique", flag: "🇲🇽", accent: "from-emerald-500/20 to-emerald-600/10", border: "border-emerald-500/20", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-500", pitchFrom: "from-emerald-900", pitchTo: "to-emerald-800" },
};

function getVenueMatches(venue: Venue, matches: Match[]): Match[] {
  return matches
    .filter((m) => {
      const stadiumMatch = m.stadiumName?.toLowerCase() === venue.stadium.toLowerCase();
      const cityMain = venue.city.split("/")[0].trim().toLowerCase();
      return stadiumMatch || m.city?.toLowerCase().includes(cityMain);
    })
    .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime());
}

const PHASE_LABELS: Record<string, string> = {
  group: "Poule", r32: "32es", r16: "16es", qf: "Quart", sf: "Demi", final: "Finale",
};

type Filter = "all" | "usa" | "canada" | "mexico";

function PitchSvg() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
      <rect x="8" y="6" width="184" height="108" rx="2" fill="none" stroke="white" strokeWidth="1.5" />
      <line x1="100" y1="6" x2="100" y2="114" stroke="white" strokeWidth="1" />
      <circle cx="100" cy="60" r="18" fill="none" stroke="white" strokeWidth="1.2" />
      <circle cx="100" cy="60" r="1.5" fill="white" />
      <rect x="8" y="34" width="26" height="52" rx="1" fill="none" stroke="white" strokeWidth="1" />
      <rect x="8" y="43" width="13" height="34" rx="1" fill="none" stroke="white" strokeWidth="0.8" />
      <rect x="166" y="34" width="26" height="52" rx="1" fill="none" stroke="white" strokeWidth="1" />
      <rect x="179" y="43" width="13" height="34" rx="1" fill="none" stroke="white" strokeWidth="0.8" />
      <circle cx="8" cy="6" r="10" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="3,2" />
      <circle cx="192" cy="6" r="10" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="3,2" />
      <circle cx="8" cy="114" r="10" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="3,2" />
      <circle cx="192" cy="114" r="10" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="3,2" />
    </svg>
  );
}

export default function VenuesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);

  useEffect(() => {
    const unsub = subscribeMatches((m) => setAllMatches(m));
    return unsub;
  }, []);

  const filtered = filter === "all" ? VENUES : VENUES.filter((v) => v.country === filter);
  const totalCapacity = VENUES.reduce((s, v) => s + v.capacity, 0);
  const totalMatches = VENUES.reduce((s, v) => s + v.matches, 0);
  const maxCapacity = Math.max(...VENUES.map((v) => v.capacity));

  const selectedVenue = selectedVenueId ? VENUES.find((v) => v.id === selectedVenueId) ?? null : null;
  const venueMatches = selectedVenue ? getVenueMatches(selectedVenue, allMatches) : [];

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
            {VENUES.length} stades · {totalMatches} matchs · {(totalCapacity / 1_000_000).toFixed(1)}M de places au total
          </p>
        </motion.div>

        {/* Country summary cards */}
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
                  "glass rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-0.5",
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
          className="rounded-3xl overflow-hidden mb-8 border border-white/10 shadow-2xl"
          style={{ height: 480 }}
        >
          <VenueMap
            venues={VENUES}
            selectedId={selectedVenueId}
            onSelect={(id) => setSelectedVenueId((p) => p === id ? null : id)}
          />
        </motion.div>

        {/* Match panel */}
        <AnimatePresence>
          {selectedVenue && (
            <motion.div key="panel" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className={clsx("glass rounded-2xl overflow-hidden mb-6 border", COUNTRY_CONFIG[selectedVenue.country].border)}
            >
              <div className={clsx("flex items-center justify-between px-5 py-4 border-b border-white/8 bg-gradient-to-r", COUNTRY_CONFIG[selectedVenue.country].accent)}>
                <div className="flex items-center gap-3">
                  <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center",
                    selectedVenue.country === "usa" ? "bg-blue-500/20" : selectedVenue.country === "canada" ? "bg-red-500/20" : "bg-emerald-500/20"
                  )}>
                    <MapPin size={16} className={selectedVenue.country === "usa" ? "text-blue-400" : selectedVenue.country === "canada" ? "text-red-400" : "text-emerald-400"} />
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
                <button onClick={() => setSelectedVenueId(null)} className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
                  <X size={14} className="text-white/60" />
                </button>
              </div>
              {venueMatches.length === 0 ? (
                <div className="py-10 text-center text-white/30 text-sm flex flex-col items-center gap-2">
                  <Calendar size={24} className="opacity-40" />
                  Aucun match chargé pour ce stade
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {venueMatches.map((match) => (
                    <div key={match.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/4 transition-colors">
                      <div className="w-24 flex-shrink-0">
                        <p className="text-xs font-semibold text-white/70">{format(match.kickoffUtc, "d MMM", { locale: fr })}</p>
                        <p className="text-xs text-white/40">{format(match.kickoffUtc, "HH:mm", { locale: fr })}</p>
                      </div>
                      {match.groupCode ? (
                        <span className="hidden sm:block text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/8 text-white/40 flex-shrink-0">Gr. {match.groupCode}</span>
                      ) : (
                        <span className="hidden sm:block text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 flex-shrink-0">{PHASE_LABELS[match.phase] ?? match.phase}</span>
                      )}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <FlagImage code={match.homeTeam.code} name={match.homeTeam.name} size={20} />
                        <span className="text-sm font-semibold text-white truncate">{match.homeTeam.name}</span>
                      </div>
                      <div className="flex-shrink-0 text-center w-16">
                        {match.isFinished ? (
                          <span className="text-sm font-black text-white">{match.homeScore} – {match.awayScore}</span>
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
            <button key={key} onClick={() => setFilter(key)}
              className={clsx("px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                filter === key ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30" : "glass text-white/50 hover:text-white"
              )}
            >{label}</button>
          ))}
        </div>

        {/* Venue cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((venue, i) => {
            const cfg = COUNTRY_CONFIG[venue.country];
            const capacityPct = (venue.capacity / maxCapacity) * 100;
            const isSelected = selectedVenueId === venue.id;
            const isFinal = venue.special === "Finale";
            const isOpening = venue.special === "Match d'ouverture";

            return (
              <motion.button
                key={venue.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedVenueId((p) => p === venue.id ? null : venue.id)}
                className={clsx(
                  "glass rounded-2xl overflow-hidden text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl w-full",
                  isSelected ? `border-2 ${isFinal ? "border-yellow-400/60" : cfg.border}` : isFinal ? "border border-yellow-400/30" : isOpening ? `border ${cfg.border}` : "border border-transparent"
                )}
              >
                {/* Pitch visual */}
                <div className={clsx("relative h-28 overflow-hidden bg-gradient-to-br", cfg.pitchFrom, cfg.pitchTo)}>
                  {/* Alternating stripes */}
                  <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 20px, transparent 20px, transparent 40px)" }}
                  />
                  <PitchSvg />

                  {/* Special badge top-left */}
                  {venue.special && (
                    <div className={clsx(
                      "absolute top-3 left-3 flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full",
                      isFinal ? "bg-yellow-400 text-black" : "bg-white/20 text-white border border-white/30"
                    )}>
                      <Star size={10} />
                      {venue.special}
                    </div>
                  )}

                  {/* Matches badge top-right */}
                  <div className={clsx("absolute top-3 right-3 text-xs font-black px-2.5 py-1 rounded-full border", cfg.badge)}>
                    {venue.matches} matchs
                  </div>

                  {/* Stadium name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent">
                    <p className="font-black text-white text-base leading-tight">{venue.city}</p>
                    <p className="text-xs text-white/50">{venue.stadium}</p>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4">
                  {/* Stats row */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <Users size={12} className="text-white/30" />
                      <span className="font-semibold text-white/70">{venue.capacity.toLocaleString("fr-FR")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <Wind size={12} className="text-white/30" />
                      <span>{venue.roof}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <Layers size={12} className="text-white/30" />
                      <span>{venue.surface}</span>
                    </div>
                  </div>

                  {venue.host && (
                    <p className="text-xs text-white/30 mb-3 flex items-center gap-1">
                      <span className="text-white/20">🏟</span> {venue.host}
                    </p>
                  )}

                  {/* Capacity bar */}
                  <div>
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${capacityPct}%` }}
                        transition={{ delay: 0.3 + i * 0.04, duration: 0.7, ease: "easeOut" }}
                        className={clsx("h-full rounded-full bg-gradient-to-r",
                          isFinal ? "from-yellow-400 to-amber-500" :
                          venue.country === "usa" ? "from-blue-500 to-blue-400" :
                          venue.country === "canada" ? "from-red-500 to-red-400" :
                          "from-emerald-500 to-emerald-400"
                        )}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-white/25">Capacité relative</span>
                      <span className="text-[10px] text-white/35 font-semibold">{Math.round(capacityPct)}%</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
