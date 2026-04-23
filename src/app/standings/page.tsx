"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import FlagImage from "@/components/FlagImage";
import { subscribeMatches } from "@/lib/firestore";
import type { Match, Team } from "@/types";
import { Loader2, ChevronUp, Minus, ChevronDown } from "lucide-react";
import clsx from "clsx";

interface TeamStanding {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function computeStandings(matches: Match[]): Map<string, TeamStanding[]> {
  const groups = new Map<string, Map<string, TeamStanding>>();

  matches
    .filter((m) => m.phase === "group")
    .forEach((m) => {
      const g = m.groupCode!;
      if (!groups.has(g)) groups.set(g, new Map());
      const gs = groups.get(g)!;

      if (!gs.has(m.homeTeamId))
        gs.set(m.homeTeamId, { team: m.homeTeam, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
      if (!gs.has(m.awayTeamId))
        gs.set(m.awayTeamId, { team: m.awayTeam, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });

      if (!m.isFinished || m.homeScore === null || m.awayScore === null) return;

      const home = gs.get(m.homeTeamId)!;
      const away = gs.get(m.awayTeamId)!;

      home.played++; away.played++;
      home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
      away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;

      if (m.homeScore > m.awayScore) {
        home.won++; home.points += 3; away.lost++;
      } else if (m.homeScore < m.awayScore) {
        away.won++; away.points += 3; home.lost++;
      } else {
        home.drawn++; home.points++; away.drawn++; away.points++;
      }
    });

  const result = new Map<string, TeamStanding[]>();
  groups.forEach((gs, group) => {
    result.set(
      group,
      Array.from(gs.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdB = b.goalsFor - b.goalsAgainst;
        const gdA = a.goalsFor - a.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.name.localeCompare(b.team.name);
      })
    );
  });
  return result;
}

function TrendIcon({ rank }: { rank: number }) {
  if (rank <= 2) return <ChevronUp size={14} className="text-emerald-400" />;
  if (rank === 3) return <Minus size={14} className="text-amber-400" />;
  return <ChevronDown size={14} className="text-red-400" />;
}

function GroupTable({ group, standings }: { group: string; standings: TeamStanding[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      {/* Group header */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/25 flex items-center justify-center">
          <span className="text-xs font-black text-yellow-400">{group}</span>
        </div>
        <h3 className="font-bold text-white text-sm">Groupe {group}</h3>
        <span className="text-xs text-white/30 ml-auto">
          {standings.filter((s) => s.played > 0).length > 0
            ? `${standings.reduce((s, t) => s + t.played, 0) / 2} matchs joués`
            : "Pas encore commencé"}
        </span>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-bold text-white/30 uppercase tracking-wider border-b border-white/5">
            <th className="text-left px-4 py-2 w-6">#</th>
            <th className="text-left px-4 py-2">Équipe</th>
            <th className="text-center px-2 py-2 w-8">J</th>
            <th className="text-center px-2 py-2 w-8">G</th>
            <th className="text-center px-2 py-2 w-8">N</th>
            <th className="text-center px-2 py-2 w-8">P</th>
            <th className="text-center px-2 py-2 w-12 hidden sm:table-cell">Buts</th>
            <th className="text-center px-2 py-2 w-10 hidden sm:table-cell">Diff</th>
            <th className="text-center px-3 py-2 w-10 font-black text-white/50">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const rank = i + 1;
            const advances = rank <= 2;
            const goalDiff = s.goalsFor - s.goalsAgainst;

            return (
              <tr
                key={s.team.id}
                className={clsx(
                  "border-b border-white/5 last:border-0 transition-colors hover:bg-white/4",
                  advances && "bg-emerald-500/5"
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <TrendIcon rank={rank} />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <FlagImage code={s.team.code} name={s.team.name} size={22} />
                    <span className={clsx(
                      "text-sm font-semibold",
                      advances ? "text-white" : "text-white/60"
                    )}>
                      {s.team.name}
                    </span>
                    {advances && (
                      <span className="hidden sm:inline text-[9px] font-bold text-emerald-400/70 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                        Q
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">{s.played}</td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">{s.won}</td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">{s.drawn}</td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">{s.lost}</td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50 hidden sm:table-cell">
                  {s.goalsFor}:{s.goalsAgainst}
                </td>
                <td className={clsx(
                  "text-center px-2 py-2.5 text-sm font-semibold hidden sm:table-cell",
                  goalDiff > 0 ? "text-emerald-400" : goalDiff < 0 ? "text-red-400" : "text-white/40"
                )}>
                  {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                </td>
                <td className="text-center px-3 py-2.5">
                  <span className={clsx(
                    "text-base font-black",
                    advances ? "text-white" : "text-white/40"
                  )}>
                    {s.points}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-[10px] text-white/25">
        <span className="flex items-center gap-1">
          <ChevronUp size={10} className="text-emerald-400" /> 2 premières équipes qualifiées
        </span>
        <span className="flex items-center gap-1">
          <Minus size={10} className="text-amber-400" /> Possible repêchage
        </span>
      </div>
    </motion.div>
  );
}

export default function StandingsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeMatches((m) => {
      setMatches(m);
      setLoading(false);
    });
  }, []);

  const standings = computeStandings(matches);
  const sortedGroups = Array.from(standings.keys()).sort();

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-4xl font-black text-white mb-2">
            Classement <span className="text-gold">Poules</span>
          </h1>
          <p className="text-white/50 text-sm">
            {sortedGroups.length} groupes · Les 2 premiers de chaque groupe sont qualifiés + 8 meilleurs 3es
          </p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white/40">Chargement des classements…</p>
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-2">Aucun classement disponible</h3>
            <p className="text-white/40 text-sm">Les classements apparaîtront dès que les matchs seront chargés.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sortedGroups.map((group, i) => (
              <motion.div
                key={group}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <GroupTable group={group} standings={standings.get(group)!} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
