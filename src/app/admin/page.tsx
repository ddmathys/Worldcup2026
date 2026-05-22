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
  fixUserProfiles,
  fixPredictionsCounts,
  getAiPredictionStatus,
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
  ListChecks,
  Sparkles,
  CheckCircle2,
  CircleDashed,
  Mail,
  Send,
  Eye,
  Pencil,
} from "lucide-react";
import type { NewsletterSection } from "@/lib/newsletter-template";
import { buildNewsletterHtml } from "@/lib/newsletter-template";
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
  const [fixLoading, setFixLoading] = useState(false);
  const [fixPredLoading, setFixPredLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [syncMatchesLoading, setSyncMatchesLoading] = useState(false);
  const [syncScoresLoading, setSyncScoresLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [resultInputs, setResultInputs] = useState<
    Record<string, { home: string; away: string; qualified: string }>
  >({});
  const [activeTab, setActiveTab] = useState<"matches" | "users" | "api" | "ia" | "newsletter">("api");
  const [aiMethod, setAiMethod] = useState("ai");
  const [aiStatus, setAiStatus] = useState<Map<string, number>>(new Map());
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);

  // Newsletter state
  interface NewsletterDraft {
    subject: string;
    preheader: string;
    sections: NewsletterSection[];
    matchesToday: { home: string; away: string; time: string; group: string }[];
    matchesTomorrow: { home: string; away: string; time: string; group: string }[];
    dateStr: string;
  }
  const [nlDraft, setNlDraft] = useState<NewsletterDraft | null>(null);
  const [nlGenerating, setNlGenerating] = useState(false);
  const [nlSending, setNlSending] = useState(false);
  const [nlSentCount, setNlSentCount] = useState<number | null>(null);
  const [nlPreviewMode, setNlPreviewMode] = useState<"edit" | "preview">("edit");

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

  useEffect(() => {
    if (activeTab === "ia" && user && profile?.role === "admin") {
      loadAiStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user, profile]);

  async function loadAiStatus() {
    const status = await getAiPredictionStatus();
    setAiStatus(status);
  }

  async function handleGenerateGroup(groupCode: string) {
    const existing = aiStatus.get(groupCode) ?? 0;
    let overwrite = false;
    if (existing > 0) {
      const confirmed = confirm(
        `Le groupe ${groupCode} a déjà ${existing}/6 pronostics IA. Écraser et regénérer ?`
      );
      if (!confirmed) return;
      overwrite = true;
    }
    setAiGenerating(groupCode);
    try {
      const res = await fetch("/api/ai/generate-predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "group", groupCode, method: aiMethod, overwrite }),
      });
      const json = await res.json() as { ok: boolean; generated: number; errors?: string[] };
      if (!json.ok) throw new Error(json.errors?.join(", ") ?? "Erreur");
      toast.success(`Groupe ${groupCode} : ${json.generated} pronostics générés`);
      await loadAiStatus();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur génération IA");
    } finally {
      setAiGenerating(null);
    }
  }

  async function handleGenerateAll() {
    const hasAny = Array.from(aiStatus.values()).some((v) => v > 0);
    let overwrite = false;
    if (hasAny) {
      const confirmed = confirm(
        "Certains groupes ont déjà des pronostics IA. Écraser tous et regénérer ?"
      );
      if (!confirmed) return;
      overwrite = true;
    }
    setAiGenerating("all");
    try {
      const res = await fetch("/api/ai/generate-predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", method: aiMethod, overwrite }),
      });
      const json = await res.json() as { ok: boolean; generated: number; skipped: number; errors?: string[] };
      if (json.errors && json.errors.length > 0) {
        toast.error(`Erreurs : ${json.errors.join(", ")}`);
      } else {
        toast.success(`${json.generated} pronostics IA générés (${json.skipped} ignorés)`);
      }
      await loadAiStatus();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur génération IA");
    } finally {
      setAiGenerating(null);
    }
  }

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

  async function handleGenerateNewsletter() {
    setNlGenerating(true);
    setNlSentCount(null);
    try {
      const res = await fetch("/api/ai/generate-newsletter");
      const json = await res.json() as NewsletterDraft & { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Erreur IA");
      setNlDraft(json);
      setNlPreviewMode("edit");
      toast.success("Newsletter générée !");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur génération");
    } finally {
      setNlGenerating(false);
    }
  }

  async function handleSendNewsletter() {
    if (!nlDraft) return;
    if (!confirm(`Envoyer cette newsletter à ${users.length} participants ?`)) return;
    setNlSending(true);
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nlDraft),
      });
      const json = await res.json() as { ok: boolean; sent: number; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Erreur envoi");
      setNlSentCount(json.sent);
      toast.success(`Newsletter envoyée à ${json.sent} participants !`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur envoi");
    } finally {
      setNlSending(false);
    }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
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

          <button
            onClick={async () => {
              setFixLoading(true);
              try {
                const n = await fixUserProfiles();
                toast.success(n > 0 ? `${n} profil(s) réparé(s) !` : "Tous les profils sont OK");
                const updated = await getAllUsers();
                setUsers(updated);
              } catch {
                toast.error("Erreur lors de la réparation.");
              } finally {
                setFixLoading(false);
              }
            }}
            disabled={fixLoading}
            className="glass rounded-2xl p-4 text-left hover:bg-white/8 transition-all disabled:opacity-50"
          >
            <Users size={20} className="text-purple-400 mb-2" />
            <p className="font-bold text-white text-sm">Réparer les profils</p>
            <p className="text-xs text-white/40 mt-0.5">
              Ajoute les champs manquants aux comptes
            </p>
            {fixLoading && <Loader2 size={14} className="animate-spin text-purple-400 mt-2" />}
          </button>

          <button
            onClick={async () => {
              setFixPredLoading(true);
              try {
                const n = await fixPredictionsCounts();
                toast.success(`Compteurs mis à jour (${n} pronostics)`);
                const updated = await getAllUsers();
                setUsers(updated);
              } catch {
                toast.error("Erreur lors du recalcul des pronos.");
              } finally {
                setFixPredLoading(false);
              }
            }}
            disabled={fixPredLoading}
            className="glass rounded-2xl p-4 text-left hover:bg-white/8 transition-all disabled:opacity-50"
          >
            <ListChecks size={20} className="text-orange-400 mb-2" />
            <p className="font-bold text-white text-sm">Recalculer pronos</p>
            <p className="text-xs text-white/40 mt-0.5">
              Resynchronise le compteur de pronostics
            </p>
            {fixPredLoading && <Loader2 size={14} className="animate-spin text-orange-400 mt-2" />}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: "api", label: "Sync API", icon: Wifi },
            { key: "ia", label: "IA Pronostics", icon: Sparkles },
            { key: "newsletter", label: "Newsletter", icon: Mail },
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

        {/* IA tab */}
        {activeTab === "ia" && (
          <div className="space-y-6">
            {/* Method selector */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-yellow-400" />
                Méthode de génération
              </h3>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "ai", label: "IA libre" },
                  { key: "fifa", label: "Classement FIFA" },
                  { key: "betting", label: "Cotes paris" },
                  { key: "form", label: "Forme actuelle" },
                  { key: "chaos", label: "Mode chaos" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setAiMethod(key)}
                    className={clsx(
                      "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                      aiMethod === key
                        ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                        : "glass text-white/50 hover:text-white border border-white/10"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate all */}
            <button
              onClick={handleGenerateAll}
              disabled={aiGenerating !== null || matches.filter(m => m.phase === "group").length === 0}
              className="w-full glass rounded-2xl p-4 flex items-center justify-between hover:bg-white/8 transition-all disabled:opacity-50 border border-yellow-400/20"
            >
              <div className="flex items-center gap-3">
                <Sparkles size={20} className="text-yellow-400" />
                <div className="text-left">
                  <p className="font-bold text-white text-sm">Générer tous les groupes</p>
                  <p className="text-xs text-white/40">12 appels IA séquentiels — 72 matchs</p>
                </div>
              </div>
              {aiGenerating === "all" ? (
                <Loader2 size={18} className="animate-spin text-yellow-400" />
              ) : (
                <span className="text-xs text-yellow-400 font-semibold bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                  Lancer →
                </span>
              )}
            </button>

            {/* Per-group grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {["A","B","C","D","E","F","G","H","I","J","K","L"].map((group) => {
                const count = aiStatus.get(group) ?? 0;
                const done = count === 6;
                const partial = count > 0 && count < 6;
                const isGenerating = aiGenerating === group;

                return (
                  <div
                    key={group}
                    className={clsx(
                      "glass rounded-2xl p-4 flex flex-col gap-3 border",
                      done ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-white">
                        Gr. {group}
                      </span>
                      {done ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : partial ? (
                        <CircleDashed size={18} className="text-yellow-400" />
                      ) : (
                        <CircleDashed size={18} className="text-white/20" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className={clsx(
                            "h-1.5 flex-1 rounded-full",
                            i < count ? "bg-yellow-400" : "bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-white/40">{count}/6 pronostics IA</p>

                    <button
                      onClick={() => handleGenerateGroup(group)}
                      disabled={aiGenerating !== null}
                      className={clsx(
                        "w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40",
                        done
                          ? "bg-white/8 text-white/60 hover:bg-white/12"
                          : "bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25 border border-yellow-400/20"
                      )}
                    >
                      {isGenerating ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Loader2 size={12} className="animate-spin" />
                          Génération…
                        </span>
                      ) : done ? (
                        "Regénérer"
                      ) : (
                        "Générer"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Newsletter tab */}
        {activeTab === "newsletter" && (
          <div className="space-y-5">
            {/* Info banner */}
            <div className="glass rounded-2xl p-4 border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Mail size={16} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Newsletter quotidienne IA</p>
                <p className="text-xs text-white/40 mt-0.5">
                  DeepSeek génère une story sur les matchs du jour / lendemain · Envoyée via Resend à tous les participants
                </p>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerateNewsletter}
              disabled={nlGenerating}
              className="w-full glass rounded-2xl p-5 flex items-center justify-between hover:bg-white/8 transition-all disabled:opacity-50 border border-purple-500/25"
            >
              <div className="flex items-center gap-3">
                <Sparkles size={20} className="text-purple-400" />
                <div className="text-left">
                  <p className="font-bold text-white text-sm">Générer avec l'IA</p>
                  <p className="text-xs text-white/40">
                    Analyse les matchs du jour / demain et rédige une newsletter engageante
                  </p>
                </div>
              </div>
              {nlGenerating ? (
                <Loader2 size={18} className="animate-spin text-purple-400" />
              ) : (
                <span className="text-xs text-purple-400 font-semibold bg-purple-500/15 px-3 py-1 rounded-full border border-purple-500/25">
                  Générer →
                </span>
              )}
            </button>

            {/* Draft editor */}
            {nlDraft && (
              <div className="glass rounded-2xl overflow-hidden border border-white/10">
                {/* Draft header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <p className="font-bold text-white text-sm flex items-center gap-2">
                    <Mail size={15} className="text-blue-400" />
                    Brouillon généré
                  </p>
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setNlPreviewMode("edit")}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                        nlPreviewMode === "edit" ? "bg-white/12 text-white" : "text-white/40 hover:text-white"
                      )}
                    >
                      <Pencil size={11} /> Éditer
                    </button>
                    <button
                      onClick={() => setNlPreviewMode("preview")}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                        nlPreviewMode === "preview" ? "bg-white/12 text-white" : "text-white/40 hover:text-white"
                      )}
                    >
                      <Eye size={11} /> Aperçu
                    </button>
                  </div>
                </div>

                {nlPreviewMode === "edit" ? (
                  <div className="p-5 space-y-4">
                    {/* Subject */}
                    <div>
                      <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">
                        Sujet de l'email
                      </label>
                      <input
                        type="text"
                        value={nlDraft.subject}
                        onChange={(e) => setNlDraft({ ...nlDraft, subject: e.target.value })}
                        className="input-field text-sm"
                      />
                    </div>

                    {/* Sections */}
                    {nlDraft.sections.map((section, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/8">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{section.emoji}</span>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => {
                              const sections = [...nlDraft.sections];
                              sections[i] = { ...sections[i], title: e.target.value };
                              setNlDraft({ ...nlDraft, sections });
                            }}
                            className="input-field text-sm font-semibold flex-1"
                            placeholder="Titre de la section"
                          />
                        </div>
                        <textarea
                          value={section.content}
                          onChange={(e) => {
                            const sections = [...nlDraft.sections];
                            sections[i] = { ...sections[i], content: e.target.value };
                            setNlDraft({ ...nlDraft, sections });
                          }}
                          rows={6}
                          className="input-field text-sm w-full resize-y font-mono leading-relaxed"
                          placeholder="Contenu de la section…"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Preview iframe */
                  <div className="p-4">
                    <PreviewIframe draft={nlDraft} />
                  </div>
                )}

                {/* Send footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/8 bg-white/3">
                  <div>
                    {nlSentCount !== null ? (
                      <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={13} />
                        Envoyée à {nlSentCount} participants
                      </p>
                    ) : (
                      <p className="text-xs text-white/30">{users.length} destinataires</p>
                    )}
                  </div>
                  <button
                    onClick={handleSendNewsletter}
                    disabled={nlSending || nlSentCount !== null}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 disabled:opacity-50"
                  >
                    {nlSending ? (
                      <><Loader2 size={14} className="animate-spin" />Envoi en cours…</>
                    ) : nlSentCount !== null ? (
                      <><CheckCircle2 size={14} />Envoyée !</>
                    ) : (
                      <><Send size={14} />Envoyer à tous</>
                    )}
                  </button>
                </div>
              </div>
            )}
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

// Preview iframe renders the newsletter HTML in isolation (safe, no XSS bleed)
function PreviewIframe({
  draft,
}: {
  draft: {
    subject: string;
    preheader: string;
    sections: NewsletterSection[];
    matchesToday: { home: string; away: string; time: string; group: string }[];
    matchesTomorrow: { home: string; away: string; time: string; group: string }[];
    dateStr: string;
  };
}) {
  const html = buildNewsletterHtml({
    ...draft,
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
  });

  return (
    <iframe
      srcDoc={html}
      title="Aperçu newsletter"
      className="w-full rounded-xl border border-white/10"
      style={{ height: "600px", background: "#0f172a" }}
      sandbox="allow-same-origin"
    />
  );
}
