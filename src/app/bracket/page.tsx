"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import { subscribeMatches } from "@/lib/firestore";
import { computeStandings, projectQualifiers, type TeamStanding } from "@/lib/standings";
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

// ── Projection (no knockout data yet) ────────────────────────────────────────

function QualifierCard({ standing, rank, confirmed }: { standing: TeamStanding; rank: number; confirmed: boolean }) {
  const gd = standing.goalsFor - standing.goalsAgainst;
  return (
    <div
      className={clsx(
        "glass rounded-xl px-3 py-2.5 flex items-center gap-2.5",
        confirmed && "border-emerald-500/30 bg-emerald-500/5"
      )}
    >
      <span className="w-5 text-center text-xs font-black text-white/30">{rank}</span>
      <FlagImage code={standing.team.code} name={standing.team.name} size={24} />
      <span className="flex-1 text-sm font-semibold text-white truncate">{standing.team.name}</span>
      <span className="text-[10px] font-bold text-white/30">Gr. {standing.groupCode}</span>
      {confirmed ? (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">
          <CheckCircle2 size={10} /> Qualifié
        </span>
      ) : (
        <span className="text-[9px] font-bold text-white/30 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full">
          {standing.points} pts · {gd >= 0 ? `+${gd}` : gd}
        </span>
      )}
    </div>
  );
}

function ProjectionSection({
  title,
  subtitle,
  teams,
  confirmedIds,
}: {
  title: string;
  subtitle: string;
  teams: TeamStanding[];
  confirmedIds: Set<string>;
}) {
  if (teams.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-xs text-white/30">{subtitle}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {teams.map((s, i) => (
          <motion.div
            key={s.team.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
          >
            <QualifierCard standing={s} rank={i + 1} confirmed={confirmedIds.has(s.team.id)} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProjectionView({ matches }: { matches: Match[] }) {
  const { firsts, seconds, bestThirds, confirmedIds } = useMemo(
    () => projectQualifiers(computeStandings(matches)),
    [matches]
  );

  const totalProjected = firsts.length + seconds.length + bestThirds.length;
  const anyGroupStarted = firsts.length > 0;

  if (!anyGroupStarted) {
    return (
      <div className="text-center py-24">
        <div className="text-5xl mb-4">🏆</div>
        <h3 className="text-xl font-bold text-white mb-2">Tableau final non disponible</h3>
        <p className="text-white/40 text-sm">
          Le tableau final sera disponible une fois la phase de poules commencée.
        </p>
      </div>
    );
  }

  return (
    <>
      <ProjectionSection
        title="1ers de groupe"
        subtitle={`${firsts.length} équipes`}
        teams={firsts}
        confirmedIds={confirmedIds}
      />
      <ProjectionSection
        title="2es de groupe"
        subtitle={`${seconds.length} équipes`}
        teams={seconds}
        confirmedIds={confirmedIds}
      />
      <ProjectionSection
        title="Meilleurs 3es"
        subtitle={`${bestThirds.length} / 8 repêchés`}
        teams={bestThirds}
        confirmedIds={confirmedIds}
      />

      <p className="text-center text-xs text-white/30 mt-4">
        {totalProjected} équipes projetées sur 32 · classement provisoire, susceptible de changer après la 3e journée.
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
    return projectQualifiers(computeStandings(matches)).confirmedIds.size;
  }, [matches, hasKnockoutData]);

  const showProjection = !loading && !hasKnockoutData;

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />

      {/* Banner — affiché tant que le vrai tableau n'existe pas encore */}
      {showProjection && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-16 left-0 right-0 z-40 border-b border-purple-500/25 bg-gradient-to-r from-purple-600/25 via-purple-500/15 to-indigo-600/25 backdrop-blur-xl"
        >
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-2.5">
            <Sparkles size={15} className="text-purple-300 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-white/90">
              Projection en direct des 1/16 de finale
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
            {showProjection ? "1/16 de finale · projection en temps réel" : "Phase à élimination directe"}
          </p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white/40">Chargement du tableau…</p>
          </div>
        ) : !hasKnockoutData ? (
          <ProjectionView matches={matches} />
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
        )}
      </div>
    </div>
  );
}
