"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import { subscribeLeaderboard, getMatches } from "@/lib/firestore";
import type { UserProfile, Match } from "@/types";
import { Trophy, Star, Target, Loader2, Medal, ListChecks, Flame } from "lucide-react";
import clsx from "clsx";

const PODIUM_CONFIG = [
  { rank: 2, height: "h-24", color: "from-slate-400 to-slate-300", label: "Argent" },
  { rank: 1, height: "h-32", color: "from-yellow-400 to-amber-300", label: "Or" },
  { rank: 3, height: "h-16", color: "from-amber-700 to-amber-600", label: "Bronze" },
];

export default function LeaderboardPage() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [lastMatch, setLastMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMatches().then((m) => {
      setTotalMatches(m.length);
      const lastFinished = m
        .filter((x) => x.isFinished)
        .sort((a, b) => b.kickoffUtc.getTime() - a.kickoffUtc.getTime())[0];
      setLastMatch(lastFinished ?? null);
    });
    const unsub = subscribeLeaderboard(
      (u) => {
        setUsers(u);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);
  const myRank = users.findIndex((u) => u.uid === user?.uid) + 1;

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Trophy className="text-yellow-400" size={32} />
            <h1 className="text-4xl font-black text-white">
              Class<span className="text-gold">ement</span>
            </h1>
          </div>
          <p className="text-white/50 text-sm">
            {users.length} participant{users.length !== 1 ? "s" : ""} · Mis à jour en temps réel
          </p>
          {lastMatch && (
            <p className="text-white/40 text-xs mt-1.5 flex items-center justify-center gap-1.5">
              <Flame size={11} className="text-orange-400/70" />
              Dernier match : {lastMatch.homeTeam.name} {lastMatch.homeScore}–{lastMatch.awayScore} {lastMatch.awayTeam.name}
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white/40">Chargement du classement…</p>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-white mb-2">Erreur de chargement</h3>
            <p className="text-white/40 text-sm">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-white mb-2">Aucun participant encore</h3>
            <p className="text-white/40">Le classement apparaîtra dès que des points seront attribués.</p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-end justify-center gap-3 mb-12"
              >
                {PODIUM_CONFIG.map(({ rank, height, color }) => {
                  const u = users[rank - 1];
                  if (!u) return null;
                  return (
                    <motion.div
                      key={rank}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: rank === 1 ? 0.2 : 0.3, type: "spring" }}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="text-center">
                        <div
                          className={clsx(
                            "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-lg font-black border-2",
                            rank === 1
                              ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400"
                              : rank === 2
                              ? "bg-slate-400/20 border-slate-400/50 text-slate-300"
                              : "bg-amber-700/20 border-amber-700/50 text-amber-600"
                          )}
                        >
                          {u.pseudo.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-xs font-bold text-white mt-1 max-w-[70px] truncate">
                          {u.pseudo}
                        </p>
                        <p
                          className={clsx(
                            "text-sm font-black",
                            rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : "text-amber-600"
                          )}
                        >
                          {u.totalPoints} pts
                        </p>
                      </div>
                      <div
                        className={clsx(
                          "w-20 sm:w-24 rounded-t-xl bg-gradient-to-b flex items-start justify-center pt-2",
                          height,
                          color
                        )}
                      >
                        <span className="text-black font-black text-sm">{rank}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* My rank (if not in top 3) */}
            {user && myRank > 3 && profile && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-6 glass rounded-2xl p-4 border border-yellow-400/20 bg-yellow-400/5"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-black text-yellow-400 w-10 text-center">
                    #{myRank}
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-yellow-400">{profile.pseudo} (moi)</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Star size={10} />
                        {profile.exactScoresCount} exacts
                      </span>
                      <span className="flex items-center gap-1">
                        <Target size={10} />
                        {profile.correctWinnerCount} vainqueurs
                      </span>
                      <span className="flex items-center gap-1">
                        <ListChecks size={10} />
                        {profile.predictionsCount}/{totalMatches} pronos
                      </span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-yellow-400">
                    {profile.totalPoints} pts
                  </span>
                </div>
              </motion.div>
            )}

            {/* Full table — défilable horizontalement sur petit écran */}
            <div className="glass rounded-2xl overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-white/8 text-xs font-semibold text-white/40 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 w-12">#</th>
                    <th className="text-left px-4 py-3">Participant</th>
                    <th className="text-center px-3 py-3">Points</th>
                    <th className="text-center px-3 py-3" title="Points obtenus sur le dernier match terminé">
                      <span className="flex items-center justify-center gap-1">
                        <Flame size={11} /> Dernier match
                      </span>
                    </th>
                    <th className="text-center px-3 py-3">
                      <span className="flex items-center justify-center gap-1">
                        <ListChecks size={11} /> Pronos
                      </span>
                    </th>
                    <th className="text-center px-3 py-3" title="Scores exacts / bons vainqueurs">
                      <span className="flex items-center justify-center gap-1">
                        <Star size={11} /> Exacts <span className="opacity-40">/</span> <Target size={11} /> Vainq.
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const rank = i + 1;
                    const isMe = u.uid === user?.uid;
                    return (
                      <motion.tr
                        key={u.uid}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={clsx(
                          "border-b border-white/5 last:border-0 transition-colors",
                          isMe ? "bg-yellow-400/8" : "hover:bg-white/4"
                        )}
                      >
                        <td className="px-4 py-3.5">
                          {rank === 1 ? (
                            <Trophy size={16} className="text-yellow-400" />
                          ) : rank === 2 ? (
                            <Medal size={16} className="text-slate-300" />
                          ) : rank === 3 ? (
                            <Medal size={16} className="text-amber-600" />
                          ) : (
                            <span className="text-sm font-bold text-white/40">{rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={clsx(
                              "font-semibold whitespace-nowrap",
                              isMe ? "text-yellow-400" : "text-white"
                            )}
                          >
                            {u.pseudo}
                            {isMe && (
                              <span className="ml-2 text-xs text-yellow-400/60 font-normal">
                                (moi)
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3.5">
                          <span
                            className={clsx(
                              "text-lg font-black",
                              rank === 1 ? "text-yellow-400" : isMe ? "text-yellow-400" : "text-white"
                            )}
                          >
                            {u.totalPoints}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3.5 text-sm">
                          {u.lastMatchPoints == null ? (
                            <span className="text-white/25">–</span>
                          ) : (
                            <span className={clsx(
                              "font-bold px-2 py-0.5 rounded-full text-xs",
                              u.lastMatchPoints > 0
                                ? "bg-orange-400/15 text-orange-300"
                                : "bg-white/8 text-white/35"
                            )}>
                              +{u.lastMatchPoints}
                            </span>
                          )}
                        </td>
                        <td className="text-center px-3 py-3.5 text-sm">
                          <span className={clsx(
                            "font-mono",
                            u.predictionsCount === totalMatches && totalMatches > 0
                              ? "text-green-400"
                              : "text-white/50"
                          )}>
                            {u.predictionsCount}/{totalMatches}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3.5 text-sm">
                          <span className="inline-flex items-center gap-2.5 text-white/55 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Star size={11} className="text-yellow-400/70" />
                              {u.exactScoresCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Target size={11} className="text-emerald-400/70" />
                              {u.correctWinnerCount}
                            </span>
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
