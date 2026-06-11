"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import FlagImage from "@/components/FlagImage";
import { subscribeMatches } from "@/lib/firestore";
import type { Match, Team } from "@/types";
import { Loader2, ChevronUp, Minus, ChevronDown, Radio } from "lucide-react";
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
  form: ("W" | "D" | "L")[];
}

function computeStandings(matches: Match[]): Map<string, TeamStanding[]> {
  const groups = new Map<string, Map<string, TeamStanding>>();
  // track finished matches per team in chronological order for form
  const teamMatchHistory = new Map<string, { kickoff: Date; result: "W" | "D" | "L" }[]>();

  const groupMatches = matches
    .filter((m) => m.phase === "group")
    .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime());

  groupMatches.forEach((m) => {
    const g = m.groupCode!;
    if (!groups.has(g)) groups.set(g, new Map());
    const gs = groups.get(g)!;

    if (!gs.has(m.homeTeamId))
      gs.set(m.homeTeamId, { team: m.homeTeam, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] });
    if (!gs.has(m.awayTeamId))
      gs.set(m.awayTeamId, { team: m.awayTeam, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] });

    if (!m.isFinished || m.homeScore === null || m.awayScore === null) return;

    const home = gs.get(m.homeTeamId)!;
    const away = gs.get(m.awayTeamId)!;

    home.played++; away.played++;
    home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won++; home.points += 3; away.lost++;
      home.form.push("W"); away.form.push("L");
    } else if (m.homeScore < m.awayScore) {
      away.won++; away.points += 3; home.lost++;
      home.form.push("L"); away.form.push("W");
    } else {
      home.drawn++; home.points++; away.drawn++; away.points++;
      home.form.push("D"); away.form.push("D");
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
      <div className="overflow-x-auto">
      <table className="w-full min-w-[480px]">
        <thead>
          <tr className="text-[10px] font-bold text-white/30 uppercase tracking-wider border-b border-white/5">
            <th className="text-left px-4 py-2 w-6">#</th>
            <th className="text-left px-4 py-2">Équipe</th>
            <th className="text-center px-2 py-2 w-8" title="Matchs joués">J</th>
            <th className="text-center px-2 py-2 w-8" title="Victoires">G</th>
            <th className="text-center px-2 py-2 w-8" title="Nuls">N</th>
            <th className="text-center px-2 py-2 w-8" title="Défaites">P</th>
            <th className="text-center px-2 py-2 w-14" title="Buts pour:contre">Buts</th>
            <th className="text-center px-2 py-2 w-10" title="Différence de buts">+/-</th>
            <th className="text-center px-2 py-2 w-16" title="Forme (3 derniers matchs)">Forme</th>
            <th className="text-center px-3 py-2 w-10 font-black text-white/50">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const rank = i + 1;
            const advances = rank <= 2;
            const mayAdvance = rank === 3;
            const goalDiff = s.goalsFor - s.goalsAgainst;
            const recentForm = s.form.slice(-3);

            return (
              <tr
                key={s.team.id}
                className={clsx(
                  "border-b border-white/5 last:border-0 transition-colors hover:bg-white/4",
                  advances && "bg-emerald-500/5",
                  mayAdvance && "bg-amber-500/3"
                )}
              >
                <td className="px-4 py-2.5">
                  <TrendIcon rank={rank} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <FlagImage code={s.team.code} name={s.team.name} size={22} />
                    <span className={clsx(
                      "text-sm font-semibold",
                      advances ? "text-white" : mayAdvance ? "text-amber-300/80" : "text-white/60"
                    )}>
                      {s.team.name}
                    </span>
                    {advances && (
                      <span className="text-[9px] font-bold text-emerald-400/70 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                        Q
                      </span>
                    )}
                    {mayAdvance && (
                      <span className="text-[9px] font-bold text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                        ?
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">{s.played}</td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">{s.won}</td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">{s.drawn}</td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">{s.lost}</td>
                <td className="text-center px-2 py-2.5 text-sm text-white/50">
                  {s.goalsFor}:{s.goalsAgainst}
                </td>
                <td className={clsx(
                  "text-center px-2 py-2.5 text-sm font-semibold",
                  goalDiff > 0 ? "text-emerald-400" : goalDiff < 0 ? "text-red-400" : "text-white/30"
                )}>
                  {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                </td>
                <td className="text-center px-2 py-2.5">
                  <div className="flex items-center justify-center gap-0.5">
                    {recentForm.length === 0 ? (
                      <span className="text-[10px] text-white/20">–</span>
                    ) : (
                      recentForm.map((r, ri) => (
                        <span
                          key={ri}
                          className={clsx(
                            "w-4 h-4 rounded-sm text-[9px] font-black flex items-center justify-center",
                            r === "W" && "bg-emerald-500/30 text-emerald-400",
                            r === "D" && "bg-amber-500/30 text-amber-400",
                            r === "L" && "bg-red-500/25 text-red-400"
                          )}
                        >
                          {r}
                        </span>
                      ))
                    )}
                  </div>
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
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-white/5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/25">
        <span className="flex items-center gap-1">
          <ChevronUp size={10} className="text-emerald-400" /> 2 premières équipes qualifiées
        </span>
        <span className="flex items-center gap-1">
          <Minus size={10} className="text-amber-400" /> Possible repêchage (3e)
        </span>
        <span className="flex items-center gap-2 ml-auto">
          <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500/30 text-emerald-400 text-[8px] font-black flex items-center justify-center">W</span>
          <span className="w-3.5 h-3.5 rounded-sm bg-amber-500/30 text-amber-400 text-[8px] font-black flex items-center justify-center">D</span>
          <span className="w-3.5 h-3.5 rounded-sm bg-red-500/25 text-red-400 text-[8px] font-black flex items-center justify-center">L</span>
          <span>3 derniers matchs</span>
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
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-emerald-400/70">
            <Radio size={11} className="animate-pulse" />
            <span>Mis à jour en temps réel après chaque match</span>
          </div>
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
