"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import { subscribeMatches } from "@/lib/firestore";
import { resolveBracket, ROUND_LABELS, ROUND_ORDER, type ResolvedMatch, type ResolvedSlot, type Round } from "@/lib/bracket";
import type { Match } from "@/types";
import FlagImage from "@/components/FlagImage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Sparkles, CheckCircle2, Info } from "lucide-react";
import clsx from "clsx";

const PHASES: { key: Match["phase"]; label: string }[] = [
  { key: "r32", label: "Tour préliminaire" },
  { key: "r16", label: "Huitièmes de finale" },
  { key: "qf", label: "Quarts de finale" },
  { key: "sf", label: "Demi-finales" },
  { key: "final", label: "Finale" },
];

// ── Carte de match « données réelles » (vue par phase) ───────────────────────
function BracketMatch({ match }: { match: Match }) {
  const isFinished = match.isFinished;
  const winner = match.qualifiedTeamId
    ? match.homeTeam.id === match.qualifiedTeamId
      ? match.homeTeam
      : match.awayTeam
    : null;

  return (
    <div className="glass rounded-xl overflow-hidden w-52 min-w-[13rem]">
      {[match.homeTeam, match.awayTeam].map((team, ti) => {
        const score = ti === 0 ? match.homeScore : match.awayScore;
        const isWinner = winner?.id === team.id;
        return (
          <div
            key={team.id}
            className={clsx(
              "flex items-center gap-2.5 px-3 py-2.5 transition-colors",
              ti === 0 && "border-b border-white/8",
              isFinished && isWinner && "bg-yellow-400/10",
              isFinished && !isWinner && "opacity-50"
            )}
          >
            <FlagImage code={team.code} name={team.name} size={24} />
            <span className={clsx("flex-1 text-sm font-semibold truncate", isWinner ? "text-yellow-400" : "text-white")}>
              {team.name}
            </span>
            {isFinished && score !== null && (
              <span className={clsx("text-sm font-black", isWinner ? "text-yellow-400" : "text-white/40")}>
                {score}
              </span>
            )}
          </div>
        );
      })}
      <div className="px-3 py-1.5 border-t border-white/8 text-xs text-white/30">
        {format(match.kickoffUtc, "d MMM · HH:mm", { locale: fr })}
      </div>
    </div>
  );
}

// ── Arbre projeté (pas encore de données d'élimination) ──────────────────────

function SlotRow({ slot, border }: { slot: ResolvedSlot; border?: boolean }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-2.5 py-1.5 h-9",
        border && "border-b border-white/8",
        slot.confirmed && "bg-emerald-500/10"
      )}
    >
      {slot.team ? (
        <>
          <FlagImage code={slot.team.team.code} name={slot.team.team.name} size={18} />
          <span className="flex-1 text-[13px] font-semibold text-white truncate">{slot.team.team.name}</span>
          {slot.confirmed && <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />}
          <span className="text-[9px] font-bold text-white/30">{slot.label}</span>
        </>
      ) : (
        <span className="flex-1 text-[11px] font-medium text-white/35 truncate">{slot.label}</span>
      )}
    </div>
  );
}

function BracketCard({ match }: { match: ResolvedMatch }) {
  return (
    <div className="relative">
      <div className="glass rounded-lg overflow-hidden w-44 sm:w-48">
        <SlotRow slot={match.a} border />
        <SlotRow slot={match.b} />
      </div>
      <span className="absolute -top-2 left-2 text-[8px] font-black text-white/25 bg-navy px-1 rounded">
        M{match.no}
      </span>
    </div>
  );
}

function BracketTree({ matches }: { matches: Match[] }) {
  const { columns, projectedTeams } = useMemo(() => resolveBracket(matches), [matches]);

  return (
    <>
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-4 sm:gap-6 min-w-max">
          {ROUND_ORDER.map((round: Round) => (
            <div key={round} className="flex flex-col">
              <div className="text-center mb-3">
                <span className="text-[11px] font-bold text-yellow-400/80 uppercase tracking-wider">
                  {ROUND_LABELS[round]}
                </span>
              </div>
              <div className="flex-1 flex flex-col justify-around gap-3">
                {columns[round].map((m) => (
                  <BracketCard key={m.no} match={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-white/30 mt-4">
        {projectedTeams} / 32 équipes positionnées · projection d&apos;après les classements actuels, susceptible de
        changer après la 3e journée. Les affiches « 1er vs 3e » dépendent des 8 meilleurs 3es.
      </p>
    </>
  );
}

export default function BracketPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState<Match["phase"]>("r16");

  useEffect(() => {
    const unsub = subscribeMatches((m) => {
      setMatches(m);
      setLoading(false);
    });
    return unsub;
  }, []);

  const knockoutMatches = matches.filter((m) => m.phase !== "group");
  const hasKnockoutData = knockoutMatches.length > 0;

  const phases = PHASES.filter((p) => knockoutMatches.some((m) => m.phase === p.key));
  const phaseMatches = knockoutMatches.filter((m) => m.phase === activePhase);

  const confirmedCount = useMemo(() => {
    if (hasKnockoutData) return 0;
    return resolveBracket(matches).confirmedCount;
  }, [matches, hasKnockoutData]);

  const groupStarted = matches.some((m) => m.phase === "group");
  const showProjection = !loading && !hasKnockoutData && groupStarted;

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />

      {/* Bandeau — affiché tant que le vrai tableau n'existe pas encore */}
      {showProjection && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-16 left-0 right-0 z-40 border-b border-purple-500/25 bg-gradient-to-r from-purple-600/25 via-purple-500/15 to-indigo-600/25 backdrop-blur-xl"
        >
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-2.5">
            <Sparkles size={15} className="text-purple-300 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-white/90">
              Tableau projeté en direct
              {confirmedCount > 0 && (
                <span className="text-purple-200">
                  {" "}— {confirmedCount} équipe{confirmedCount > 1 ? "s" : ""} déjà qualifiée{confirmedCount > 1 ? "s" : ""}
                </span>
              )}
            </p>
            <span className="ml-auto hidden sm:flex items-center gap-1 text-[11px] text-white/50">
              <Info size={11} /> d&apos;après les classements actuels
            </span>
          </div>
        </motion.div>
      )}

      <div className={clsx("max-w-6xl mx-auto px-4 pb-16", showProjection ? "pt-32" : "pt-24")}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-black text-white mb-2">
            Tableau <span className="text-gold">final</span>
          </h1>
          <p className="text-white/50 text-sm">
            {showProjection ? "Arborescence complète · qui affronte qui (projection)" : "Phase à élimination directe"}
          </p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white/40">Chargement du tableau…</p>
          </div>
        ) : hasKnockoutData ? (
          <>
            {/* Phase tabs (données réelles) */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {phases.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActivePhase(key)}
                  className={clsx(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                    activePhase === key
                      ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                      : "glass text-white/50 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              {phaseMatches.length === 0 ? (
                <p className="text-white/30 text-sm">Aucun match pour cette phase.</p>
              ) : (
                phaseMatches.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <BracketMatch match={m} />
                  </motion.div>
                ))
              )}
            </div>
          </>
        ) : groupStarted ? (
          <BracketTree matches={matches} />
        ) : (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-white mb-2">Tableau final non disponible</h3>
            <p className="text-white/40 text-sm">
              Le tableau final sera disponible une fois la phase de poules commencée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
