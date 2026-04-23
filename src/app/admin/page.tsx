"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import {
  subscribeMatches,
  setMatchResult,
  updateMatchStatus,
  seedMatches,
  getAllUsers,
  recalculateAllPoints,
} from "@/lib/firestore";
import { generateSampleMatches } from "@/lib/seed-data";
import type { Match, UserProfile } from "@/types";
import FlagImage from "@/components/FlagImage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import {
  Settings,
  RefreshCw,
  Database,
  Users,
  Trophy,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Wifi,
  Clock,
} from "lucide-react";
import clsx from "clsx";

async function callSyncAPI(type: "matches" | "scores") {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Erreur API");
  return json;
}

export default function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [syncMatchesLoading, setSyncMatchesLoading] = useState(false);
  const [syncScoresLoading, setSyncScoresLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [resultInputs, setResultInputs] = useState<
    Record<string, { home: string; away: string; qualified: string }>
  >({});
  const [activeTab, setActiveTab] = useState<"matches" | "users" | "api">("api");

  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== "admin")) {
      router.push("/");
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (!user || profile?.role !== "admin") return;
    const unsub = subscribeMatches((m) => {
      setMatches(m);
      setLoadingMatches(false);
    });
    getAllUsers().then(setUsers);
    return unsub;
  }, [user, profile]);

  async function handleSeedMatches() {
    if (!confirm("Charger les matchs de démonstration dans Firestore ?")) return;
    setSeedLoading(true);
    try {
      const sample = generateSampleMatches();
      await seedMatches(sample as Parameters<typeof seedMatches>[0]);
      toast.success(`${sample.length} matchs chargés !`);
    } catch {
      toast.error("Erreur lors du chargement des matchs.");
    } finally {
      setSeedLoading(false);
    }
  }

  async function handleRecalculate() {
    setRecalcLoading(true);
    try {
      await recalculateAllPoints();
      toast.success("Points recalculés !");
      const updated = await getAllUsers();
      setUsers(updated);
    } catch {
      toast.error("Erreur lors du recalcul.");
    } finally {
      setRecalcLoading(false);
    }
  }

  async function handleSyncMatches() {
    setSyncMatchesLoading(true);
    try {
      const res = await callSyncAPI("matches");
      toast.success(`${res.synced} matchs synchronisés`);
      setLastSync(new Date());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur sync matchs");
    } finally {
      setSyncMatchesLoading(false);
    }
  }

  async function handleSyncScores() {
    setSyncScoresLoading(true);
    try {
      const res = await callSyncAPI("scores");
      toast.success(`${res.updated} scores mis à jour + points recalculés`);
      setLastSync(new Date());
      const updated = await getAllUsers();
      setUsers(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur sync scores");
    } finally {
      setSyncScoresLoading(false);
    }
  }

  async function handleSetResult(match: Match) {
    const inputs = resultInputs[match.id];
    if (!inputs) return;
    const h = parseInt(inputs.home);
    const a = parseInt(inputs.away);
    if (isNaN(h) || isNaN(a)) {
      toast.error("Scores invalides");
      return;
    }
    const qualId =
      match.phase !== "group"
        ? inputs.qualified || null
        : null;
    try {
      await setMatchResult(match.id, h, a, qualId);
      toast.success("Résultat enregistré !");
      setExpandedMatch(null);
    } catch {
      toast.error("Erreur.");
    }
  }

  async function handleToggleStatus(match: Match) {
    const newStatus = match.status === "open" ? "locked" : "open";
    await updateMatchStatus(match.id, newStatus);
    toast.success(`Match ${newStatus === "open" ? "ouvert" : "verrouillé"}`);
  }

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <Loader2 className="animate-spin text-yellow-400" size={32} />
      </div>
    );
  }

  if (profile.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <Settings size={24} className="text-yellow-400" />
          <div>
            <h1 className="text-3xl font-black text-white">
              Panel <span className="text-gold">Admin</span>
            </h1>
            <p className="text-white/40 text-sm">Gestion des matchs et des scores</p>
          </div>
        </motion.div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <button
            onClick={handleSeedMatches}
            disabled={seedLoading}
            className="glass rounded-2xl p-4 text-left hover:bg-white/8 transition-all group disabled:opacity-50"
          >
            <Database size={20} className="text-emerald-400 mb-2" />
            <p className="font-bold text-white text-sm">Charger matchs démo</p>
            <p className="text-xs text-white/40 mt-0.5">
              Seed Firestore avec les matchs de groupe
            </p>
            {seedLoading && (
              <Loader2 size={14} className="animate-spin text-emerald-400 mt-2" />
            )}
          </button>

          <button
            onClick={handleRecalculate}
            disabled={recalcLoading}
            className="glass rounded-2xl p-4 text-left hover:bg-white/8 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className="text-blue-400 mb-2" />
            <p className="font-bold text-white text-sm">Recalculer les points</p>
            <p className="text-xs text-white/40 mt-0.5">
              Recalcul pour tous les matchs terminés
            </p>
            {recalcLoading && (
              <Loader2 size={14} className="animate-spin text-blue-400 mt-2" />
            )}
          </button>

          <div className="glass rounded-2xl p-4">
            <Trophy size={20} className="text-yellow-400 mb-2" />
            <p className="font-bold text-white text-sm">Statistiques</p>
            <p className="text-xs text-white/40 mt-0.5">
              {matches.length} matchs · {users.length} participants
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: "api", label: "Sync API", icon: Wifi },
            { key: "matches", label: "Matchs", icon: Trophy },
            { key: "users", label: "Participants", icon: Users },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                activeTab === key
                  ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                  : "glass text-white/50 hover:text-white"
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* API Sync tab */}
        {activeTab === "api" && (
          <div className="space-y-4">
            {/* API info banner */}
            <div className="glass rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Wifi size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">wc2026api.com · Connecté</p>
                <p className="text-xs text-white/40">100 req/jour · Scores en temps réel · 104 matchs</p>
              </div>
            </div>

            {/* Sync actions */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <RefreshCw size={16} className="text-blue-400" />
                Synchronisation
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <button
                  onClick={handleSyncMatches}
                  disabled={syncMatchesLoading}
                  className="glass rounded-xl p-4 text-left hover:bg-white/8 transition-all disabled:opacity-50"
                >
                  <Database size={18} className="text-emerald-400 mb-2" />
                  <p className="font-bold text-white text-sm">Sync tous les matchs</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Importe les 104 matchs depuis l'API
                  </p>
                  {syncMatchesLoading && (
                    <Loader2 size={14} className="animate-spin text-emerald-400 mt-2" />
                  )}
                </button>

                <button
                  onClick={handleSyncScores}
                  disabled={syncScoresLoading}
                  className="glass rounded-xl p-4 text-left hover:bg-white/8 transition-all disabled:opacity-50"
                >
                  <Wifi size={18} className="text-blue-400 mb-2" />
                  <p className="font-bold text-white text-sm">Sync scores manuellement</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Met à jour les scores + recalcule les points
                  </p>
                  {syncScoresLoading && (
                    <Loader2 size={14} className="animate-spin text-blue-400 mt-2" />
                  )}
                </button>
              </div>

              {/* Sync strategy info */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <Clock size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Stratégie de synchronisation</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-white/40">
                    <li>· Cron Vercel toutes les 30 min via <code className="text-white/60">/api/cron/sync-scores</code></li>
                    <li>· Sync uniquement si un match a débuté depuis ≥ 3h30 et n'est pas terminé</li>
                    <li>· Pronostics verrouillés automatiquement 2h avant le coup d'envoi</li>
                    <li>· Les scores se rafraîchissent en temps réel pour tous les utilisateurs</li>
                  </ul>
                </div>
                <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/15 px-2 py-1 rounded-full border border-emerald-500/20 flex-shrink-0">
                  Actif
                </span>
              </div>

              {lastSync && (
                <p className="text-xs text-white/30 mt-3 flex items-center gap-1.5">
                  <Clock size={10} />
                  Dernière sync : {format(lastSync, "HH:mm:ss", { locale: fr })}
                </p>
              )}
            </div>

            {/* Status */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <Trophy size={16} className="text-yellow-400" />
                État de la base
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Matchs chargés", value: matches.length },
                  { label: "Matchs terminés", value: matches.filter(m => m.isFinished).length },
                  { label: "Participants", value: users.length },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-yellow-400">{s.value}</div>
                    <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Matches tab */}
        {activeTab === "matches" && (
          <div className="space-y-2">
            {loadingMatches ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-yellow-400" size={28} />
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                Aucun match. Utilise "Charger matchs démo" pour démarrer.
              </div>
            ) : (
              matches.map((match) => {
                const expanded = expandedMatch === match.id;
                const inp = resultInputs[match.id] ?? {
                  home: match.homeScore !== null ? String(match.homeScore) : "",
                  away: match.awayScore !== null ? String(match.awayScore) : "",
                  qualified: match.qualifiedTeamId ?? "",
                };

                return (
                  <div key={match.id} className="glass rounded-2xl overflow-hidden">
                    <button
                      onClick={() =>
                        setExpandedMatch(expanded ? null : match.id)
                      }
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all text-left"
                    >
                      <FlagImage code={match.homeTeam.code} name={match.homeTeam.name} size={24} />
                      <span className="text-sm font-semibold text-white flex-1">
                        {match.homeTeam.name} vs {match.awayTeam.name}
                      </span>
                      <FlagImage code={match.awayTeam.code} name={match.awayTeam.name} size={24} />
                      <span className="text-xs text-white/30 mx-2">
                        {format(match.kickoffUtc, "d MMM HH:mm", { locale: fr })}
                      </span>
                      <span
                        className={clsx(
                          "text-xs px-2 py-0.5 rounded-full font-semibold",
                          match.isFinished
                            ? "bg-slate-500/20 text-slate-400"
                            : match.status === "open"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        )}
                      >
                        {match.isFinished
                          ? `${match.homeScore}–${match.awayScore}`
                          : match.status}
                      </span>
                      {expanded ? (
                        <ChevronUp size={16} className="text-white/30" />
                      ) : (
                        <ChevronDown size={16} className="text-white/30" />
                      )}
                    </button>

                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="px-4 pb-4 border-t border-white/8"
                      >
                        <div className="pt-4 space-y-4">
                          {/* Score inputs */}
                          <div>
                            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                              Résultat officiel
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 text-right text-sm font-semibold text-white">
                                {match.homeTeam.name}
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={inp.home}
                                onChange={(e) =>
                                  setResultInputs((prev) => ({
                                    ...prev,
                                    [match.id]: { ...inp, home: e.target.value },
                                  }))
                                }
                                className="input-score"
                                placeholder="0"
                              />
                              <span className="text-white/30 font-bold">–</span>
                              <input
                                type="number"
                                min={0}
                                value={inp.away}
                                onChange={(e) =>
                                  setResultInputs((prev) => ({
                                    ...prev,
                                    [match.id]: { ...inp, away: e.target.value },
                                  }))
                                }
                                className="input-score"
                                placeholder="0"
                              />
                              <div className="flex-1 text-left text-sm font-semibold text-white">
                                {match.awayTeam.name}
                              </div>
                            </div>
                          </div>

                          {/* Qualified team (knockout) */}
                          {match.phase !== "group" && (
                            <div>
                              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                                Équipe qualifiée
                              </p>
                              <div className="flex gap-2">
                                {[match.homeTeam, match.awayTeam].map((team) => (
                                  <button
                                    key={team.id}
                                    onClick={() =>
                                      setResultInputs((prev) => ({
                                        ...prev,
                                        [match.id]: { ...inp, qualified: team.id },
                                      }))
                                    }
                                    className={clsx(
                                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all",
                                      inp.qualified === team.id
                                        ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/40"
                                        : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                                    )}
                                  >
                                    <FlagImage code={team.code} name={team.name} size={20} />
                                    {team.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSetResult(match)}
                              className="btn-gold flex items-center gap-2 text-sm py-2"
                            >
                              <Save size={14} />
                              Enregistrer résultat
                            </button>
                            <button
                              onClick={() => handleToggleStatus(match)}
                              className="btn-outline text-sm py-2"
                            >
                              {match.status === "open" ? "Verrouiller" : "Ouvrir"}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Users tab */}
        {activeTab === "users" && (
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8 text-xs font-semibold text-white/40 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Pseudo</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Rôle</th>
                  <th className="text-right px-4 py-3">Points</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid} className="border-b border-white/5 last:border-0 hover:bg-white/4">
                    <td className="px-4 py-3 font-semibold text-white">{u.pseudo}</td>
                    <td className="px-4 py-3 text-white/50 text-sm hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={clsx(
                          "text-xs px-2 py-1 rounded-full font-semibold",
                          u.role === "admin"
                            ? "bg-yellow-400/20 text-yellow-400"
                            : "bg-white/8 text-white/40"
                        )}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-white">
                      {u.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
