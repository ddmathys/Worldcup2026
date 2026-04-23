"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import { subscribeMatches } from "@/lib/firestore";
import type { Match } from "@/types";
import FlagImage from "@/components/FlagImage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

const PHASES: { key: Match["phase"]; label: string }[] = [
  { key: "r32", label: "Tour préliminaire" },
  { key: "r16", label: "Huitièmes de finale" },
  { key: "qf", label: "Quarts de finale" },
  { key: "sf", label: "Demi-finales" },
  { key: "final", label: "Finale" },
];

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

export default function BracketPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState<Match["phase"]>("r16");

  useEffect(() => {
    const unsub = subscribeMatches((m) => {
      const knockouts = m.filter((x) => x.phase !== "group");
      setMatches(knockouts);
      setLoading(false);
    });
    return unsub;
  }, []);

  const phases = PHASES.filter((p) =>
    matches.some((m) => m.phase === p.key)
  );

  const phaseMatches = matches.filter((m) => m.phase === activePhase);

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-black text-white mb-2">
            Tableau <span className="text-gold">final</span>
          </h1>
          <p className="text-white/50 text-sm">Phase à élimination directe</p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white/40">Chargement du tableau…</p>
          </div>
        ) : phases.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-white mb-2">
              Tableau final non disponible
            </h3>
            <p className="text-white/40 text-sm">
              Le tableau final sera disponible une fois la phase de poules terminée.
            </p>
          </div>
        ) : (
          <>
            {/* Phase tabs */}
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

            {/* Matches grid */}
            <div className="flex flex-wrap justify-center gap-4">
              {phaseMatches.length === 0 ? (
                <p className="text-white/30 text-sm">
                  Aucun match pour cette phase.
                </p>
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
        )}
      </div>
    </div>
  );
}
