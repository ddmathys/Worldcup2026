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

// ── Ligne d'équipe (slot) ────────────────────────────────────────────────────
function SlotRow({ slot, border }: { slot: ResolvedSlot; border?: boolean }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-2.5 h-9",
        border && "border-b border-white/8",
        slot.winner && "bg-yellow-400/10",
        slot.confirmed && !slot.winner && "bg-emerald-500/10"
      )}
    >
      {slot.team ? (
        <>
          <FlagImage code={slot.team.code} name={slot.team.name} size={18} />
          <span
            className={clsx(
              "flex-1 text-[13px] font-semibold truncate",
              slot.winner ? "text-yellow-400" : slot.score != null && !slot.winner ? "text-white/40" : "text-white"
            )}
          >
            {slot.team.name}
          </span>
          {slot.score != null ? (
            <span className={clsx("text-[13px] font-black w-4 text-center", slot.winner ? "text-yellow-400" : "text-white/40")}>
              {slot.score}
            </span>
          ) : slot.confirmed ? (
            <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <span className="text-[9px] font-bold text-white/30">{slot.label}</span>
          )}
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
      <div className={clsx("glass rounded-lg overflow-hidden w-44 sm:w-48", match.live && "border-blue-500/40")}>
        <SlotRow slot={match.a} border />
        <SlotRow slot={match.b} />
        {(match.kickoff || match.live) && (
          <div className="px-2.5 py-1 border-t border-white/8 text-[10px] flex items-center justify-between">
            <span className="text-white/30">
              {match.kickoff ? format(match.kickoff, "d MMM · HH:mm", { locale: fr }) : ""}
            </span>
            {match.live ? (
              <span className="text-blue-400 font-bold uppercase tracking-wide">live</span>
            ) : match.finished ? (
              <span className="text-white/40 font-semibold">terminé</span>
            ) : null}
          </div>
        )}
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
        {projectedTeams} / 32 équipes positionnées · scores réels affichés au fil des matchs, le reste est projeté
        d&apos;après les classements (les affiches « 1er vs 3e » dépendent des 8 meilleurs 3es).
      </p>
    </>
  );
}

export default function BracketPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeMatches((m) => {
      setMatches(m);
      setLoading(false);
    });
    return unsub;
  }, []);

  const { confirmedCount, hasKnockout } = useMemo(() => {
    const r = resolveBracket(matches);
    return { confirmedCount: r.confirmedCount, hasKnockout: matches.some((m) => m.phase !== "group") };
  }, [matches]);

  const groupStarted = matches.some((m) => m.phase === "group");
  const showBracket = !loading && groupStarted;

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />

      {/* Bandeau d'info — tableau en direct */}
      {showBracket && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-16 left-0 right-0 z-40 border-b border-purple-500/25 bg-gradient-to-r from-purple-600/25 via-purple-500/15 to-indigo-600/25 backdrop-blur-xl"
        >
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-2.5">
            <Sparkles size={15} className="text-purple-300 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-white/90">
              {hasKnockout ? "Tableau en direct" : "Tableau projeté en direct"}
              {!hasKnockout && confirmedCount > 0 && (
                <span className="text-purple-200">
                  {" "}— {confirmedCount} équipe{confirmedCount > 1 ? "s" : ""} déjà qualifiée{confirmedCount > 1 ? "s" : ""}
                </span>
              )}
            </p>
            <span className="ml-auto hidden sm:flex items-center gap-1 text-[11px] text-white/50">
              <Info size={11} /> scores réels + projection
            </span>
          </div>
        </motion.div>
      )}

      <div className={clsx("max-w-6xl mx-auto px-4 pb-16", showBracket ? "pt-32" : "pt-24")}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-black text-white mb-2">
            Tableau <span className="text-gold">final</span>
          </h1>
          <p className="text-white/50 text-sm">Arborescence complète · qui affronte qui, du tour préliminaire à la finale</p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white/40">Chargement du tableau…</p>
          </div>
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
