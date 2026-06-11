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
  getAllUsers,
  recalculateAllPoints,
} from "@/lib/firestore";
import type { Match, UserProfile } from "@/types";
import FlagImage from "@/components/FlagImage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import {
  Settings,
  RefreshCw,
  Users,
  Trophy,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Wifi,
  Lock,
  Mail,
  Send,
  Eye,
  Pencil,
  Sparkles,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { buildNewsletterHtml } from "@/lib/newsletter-template";
import type { NewsletterDraft as NLDraft } from "@/lib/newsletter-template";
import { buildFreeEmailHtml } from "@/lib/email-templates";
import clsx from "clsx";

async function callSyncAPI(type: "scores") {
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
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [syncScoresLoading, setSyncScoresLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [resultInputs, setResultInputs] = useState<
    Record<string, { home: string; away: string; qualified: string }>
  >({});
  const [activeTab, setActiveTab] = useState<"dashboard" | "matches" | "newsletter" | "users">("dashboard");

  const [nlDraft, setNlDraft] = useState<NLDraft | null>(null);
  const [nlGenerating, setNlGenerating] = useState(false);
  const [nlSending, setNlSending] = useState(false);
  const [nlSentCount, setNlSentCount] = useState<number | null>(null);
  const [nlPreviewMode, setNlPreviewMode] = useState<"edit" | "preview">("edit");

  const [emailMode, setEmailMode] = useState<"ai" | "free">("free");
  const [freeSubject, setFreeSubject] = useState("");
  const [freeBody, setFreeBody] = useState("");
  const [freeSending, setFreeSending] = useState(false);
  const [freeSentCount, setFreeSentCount] = useState<number | null>(null);
  const [freePreview, setFreePreview] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);

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

  async function handleMigrateLockAt() {
    setMigrateLoading(true);
    try {
      const res = await fetch("/api/admin/migrate-lockat", { method: "POST" });
      const json = await res.json() as { ok: boolean; updated: number; skipped: number; total: number };
      if (!json.ok) throw new Error("Échec migration");
      toast.success(`Migration OK — ${json.updated} matchs mis à jour sur ${json.total}`);
    } catch {
      toast.error("Erreur lors de la migration.");
    } finally {
      setMigrateLoading(false);
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

  async function handleSyncScores() {
    setSyncScoresLoading(true);
    try {
      const res = await callSyncAPI("scores");
      toast.success(`${res.updated ?? 0} scores mis à jour + points recalculés`);
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
    const qualId = match.phase !== "group" ? inputs.qualified || null : null;
    try {
      await setMatchResult(match.id, h, a, qualId);
      await recalculateAllPoints();
      toast.success("Résultat enregistré + points recalculés !");
      setExpandedMatch(null);
      const updated = await getAllUsers();
      setUsers(updated);
    } catch {
      toast.error("Erreur.");
    }
  }

  async function handleToggleStatus(match: Match) {
    const newStatus = match.status === "open" ? "locked" : "open";
    await updateMatchStatus(match.id, newStatus);
    toast.success(`Match ${newStatus === "open" ? "ouvert" : "verrouillé"}`);
  }

  async function handleSendFreeEmail() {
    if (!freeSubject.trim() || !freeBody.trim()) {
      toast.error("Remplis le sujet et le corps de l'email.");
      return;
    }
    if (!confirm(`Envoyer cet email à ${users.length} participants ?`)) return;
    setFreeSending(true);
    try {
      const res = await fetch("/api/email/send-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: freeSubject, body: freeBody }),
      });
      const json = await res.json() as { ok: boolean; sent: number; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Erreur envoi");
      setFreeSentCount(json.sent);
      toast.success(`Email envoyé à ${json.sent} participants !`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur envoi");
    } finally {
      setFreeSending(false);
    }
  }

  async function handleSendTestEmail() {
    if (!freeSubject.trim() || !freeBody.trim()) {
      toast.error("Remplis le sujet et le corps avant d'envoyer un test.");
      return;
    }
    if (!testEmail.trim()) {
      toast.error("Saisis une adresse email de test.");
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch("/api/email/send-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: freeSubject, body: freeBody, testEmail: testEmail.trim() }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Erreur envoi test");
      setTestSent(true);
      toast.success(`Email de test envoyé à ${testEmail} !`);
      setTimeout(() => setTestSent(false), 4000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur envoi test");
    } finally {
      setTestSending(false);
    }
  }

  async function handleGenerateNewsletter() {
    setNlGenerating(true);
    setNlSentCount(null);
    try {
      const res = await fetch("/api/ai/generate-newsletter");
      const json = await res.json() as NLDraft & { ok: boolean; error?: string };
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

  const finishedCount = matches.filter((m) => m.isFinished).length;

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
            <p className="text-white/40 text-sm">worldcup2026friend.com</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: "dashboard", label: "Dashboard", icon: Settings },
            { key: "matches", label: "Matchs", icon: Trophy },
            { key: "newsletter", label: "Newsletter", icon: Mail },
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

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div className="space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Matchs chargés", value: matches.length, color: "text-yellow-400" },
                { label: "Matchs terminés", value: finishedCount, color: "text-emerald-400" },
                { label: "Participants", value: users.length, color: "text-blue-400" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-2xl p-4 text-center">
                  <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-white/40 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Workaround actions */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <RefreshCw size={15} className="text-yellow-400" />
                  Actions manuelles
                </h3>
                <p className="text-xs text-white/35 mt-0.5">Workarounds si le cron automatique ne tourne pas</p>
              </div>

              <div className="divide-y divide-white/5">
                {/* Sync scores */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Synchroniser les scores</p>
                    <p className="text-xs text-white/35 mt-0.5">Récupère les scores depuis l'API + recalcule les points</p>
                    <p className="text-[10px] text-white/20 mt-0.5">Utiliser si cron-job.org ne tourne pas</p>
                  </div>
                  {lastSync && (
                    <span className="text-[10px] text-white/25 hidden sm:block">
                      Dernière sync : {format(lastSync, "HH:mm:ss", { locale: fr })}
                    </span>
                  )}
                  <button
                    onClick={handleSyncScores}
                    disabled={syncScoresLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-all disabled:opacity-40 shrink-0"
                  >
                    {syncScoresLoading ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                    Lancer
                  </button>
                </div>

                {/* Recalc points */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Recalculer les points</p>
                    <p className="text-xs text-white/35 mt-0.5">Recalcule les points de tous les joueurs sur les matchs terminés</p>
                    <p className="text-[10px] text-white/20 mt-0.5">Utiliser après avoir entré un score manuellement dans l'onglet Matchs</p>
                  </div>
                  <button
                    onClick={handleRecalculate}
                    disabled={recalcLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all disabled:opacity-40 shrink-0"
                  >
                    {recalcLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Lancer
                  </button>
                </div>

                {/* Migrate lockAt */}
                <div className="flex items-center gap-4 px-5 py-4 bg-yellow-400/3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      Migrer verrou 1h
                      <span className="text-[9px] font-bold text-yellow-400 bg-yellow-400/15 border border-yellow-400/25 px-1.5 py-0.5 rounded-full">ONE-SHOT</span>
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">Passe tous les matchs à lockAt = kickoff − 1h</p>
                    <p className="text-[10px] text-white/20 mt-0.5">À faire une seule fois avant le 11 juin · Sans effet si déjà fait</p>
                  </div>
                  <button
                    onClick={handleMigrateLockAt}
                    disabled={migrateLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-yellow-400/15 text-yellow-400 border border-yellow-400/25 hover:bg-yellow-400/25 transition-all disabled:opacity-40 shrink-0"
                  >
                    {migrateLoading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                    Lancer
                  </button>
                </div>
              </div>
            </div>

            {/* Cron status */}
            <div className="glass rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Radio size={16} className="text-emerald-400 animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">cron-job.org · Actif</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Appelle <code className="text-white/60">/api/cron/sync-scores</code> toutes les 30 min · Scores automatiques ~30 min après chaque match
                  </p>
                </div>
                <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/25 shrink-0">
                  ✓ Configuré
                </span>
              </div>
            </div>

          </div>
        )}

        {/* ── MATCHES ── */}
        {activeTab === "matches" && (
          <div className="space-y-2">
            <p className="text-xs text-white/35 px-1 mb-4">
              Clique sur un match pour saisir le résultat officiel. Les points sont recalculés automatiquement.
            </p>
            {loadingMatches ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-yellow-400" size={28} />
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-16 text-white/40">Aucun match en base.</div>
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
                      onClick={() => setExpandedMatch(expanded ? null : match.id)}
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
                      <span className={clsx(
                        "text-xs px-2 py-0.5 rounded-full font-semibold",
                        match.isFinished ? "bg-slate-500/20 text-slate-400"
                          : match.status === "open" ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      )}>
                        {match.isFinished ? `${match.homeScore}–${match.awayScore}` : match.status}
                      </span>
                      {expanded ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
                    </button>

                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="px-4 pb-4 border-t border-white/8"
                      >
                        <div className="pt-4 space-y-4">
                          <div>
                            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                              Résultat officiel
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 text-right text-sm font-semibold text-white">
                                {match.homeTeam.name}
                              </div>
                              <input
                                type="number" min={0}
                                value={inp.home}
                                onChange={(e) => setResultInputs((prev) => ({ ...prev, [match.id]: { ...inp, home: e.target.value } }))}
                                className="input-score" placeholder="0"
                              />
                              <span className="text-white/30 font-bold">–</span>
                              <input
                                type="number" min={0}
                                value={inp.away}
                                onChange={(e) => setResultInputs((prev) => ({ ...prev, [match.id]: { ...inp, away: e.target.value } }))}
                                className="input-score" placeholder="0"
                              />
                              <div className="flex-1 text-left text-sm font-semibold text-white">
                                {match.awayTeam.name}
                              </div>
                            </div>
                          </div>

                          {match.phase !== "group" && (
                            <div>
                              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                                Équipe qualifiée
                              </p>
                              <div className="flex gap-2">
                                {[match.homeTeam, match.awayTeam].map((team) => (
                                  <button
                                    key={team.id}
                                    onClick={() => setResultInputs((prev) => ({ ...prev, [match.id]: { ...inp, qualified: team.id } }))}
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

        {/* ── NEWSLETTER ── */}
        {activeTab === "newsletter" && (
          <div className="space-y-5">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-xl p-1 w-fit">
              <button
                onClick={() => setEmailMode("free")}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  emailMode === "free" ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30" : "text-white/40 hover:text-white"
                )}
              >
                <Pencil size={13} /> Écrire moi-même
              </button>
              <button
                onClick={() => setEmailMode("ai")}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  emailMode === "ai" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "text-white/40 hover:text-white"
                )}
              >
                <Sparkles size={13} /> Générer avec l'IA
              </button>
            </div>

            {/* FREE EMAIL */}
            {emailMode === "free" && (
              <div className="glass rounded-2xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <p className="font-bold text-white text-sm flex items-center gap-2">
                    <Mail size={15} className="text-yellow-400" />
                    Email libre
                  </p>
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setFreePreview(false)}
                      className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                        !freePreview ? "bg-white/12 text-white" : "text-white/40 hover:text-white")}
                    >
                      <Pencil size={11} /> Éditer
                    </button>
                    <button
                      onClick={() => setFreePreview(true)}
                      disabled={!freeBody.trim()}
                      className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-30",
                        freePreview ? "bg-white/12 text-white" : "text-white/40 hover:text-white")}
                    >
                      <Eye size={11} /> Aperçu
                    </button>
                  </div>
                </div>

                {!freePreview ? (
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-1.5">
                        Sujet de l'email
                      </label>
                      <input
                        type="text" value={freeSubject}
                        onChange={(e) => setFreeSubject(e.target.value)}
                        placeholder="ex: ⚽ J-1 avant la Coupe du Monde 2026 !"
                        className="input-field text-sm w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                          Corps de l'email
                        </label>
                        <span className="text-[10px] text-yellow-400/70 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-2 py-0.5">
                          [Prénom] → pseudo de chaque participant
                        </span>
                      </div>
                      <textarea
                        value={freeBody}
                        onChange={(e) => { setFreeBody(e.target.value); setFreeSentCount(null); }}
                        rows={18}
                        placeholder={`Salut [Prénom],\n\nTon message ici...\n\n🏆 Une section\nLe contenu.\n\n👉 Lien\nhttps://worldcup2026friend.com`}
                        className="input-field text-sm w-full resize-y font-mono leading-relaxed"
                        style={{ minHeight: 340 }}
                      />
                      <p className="text-[10px] text-white/25 mt-1.5">
                        Lignes commençant par un emoji → mises en gras · Paragraphes séparés par une ligne vide
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <iframe
                      srcDoc={buildFreeEmailHtml(freeSubject || "(sans sujet)", freeBody, "Prénom")}
                      title="Aperçu email"
                      className="w-full rounded-xl border border-white/10"
                      style={{ height: 600, background: "#0f172a" }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}

                <div className="px-5 py-4 border-t border-white/8 bg-white/3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="email" value={testEmail}
                      onChange={(e) => { setTestEmail(e.target.value); setTestSent(false); }}
                      placeholder="adresse@test.com"
                      className="input-field text-sm flex-1 py-2"
                    />
                    <button
                      onClick={handleSendTestEmail}
                      disabled={testSending || !freeSubject.trim() || !freeBody.trim()}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border whitespace-nowrap disabled:opacity-40",
                        testSent ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-white/8 text-white/60 hover:bg-white/12 border-white/10"
                      )}
                    >
                      {testSending ? <Loader2 size={13} className="animate-spin" /> : testSent ? <CheckCircle2 size={13} /> : <Send size={13} />}
                      {testSent ? "Envoyé !" : "Tester"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    {freeSentCount !== null ? (
                      <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Envoyé à {freeSentCount} participants
                      </p>
                    ) : (
                      <p className="text-xs text-white/30">{users.length} destinataires · noreply@dmathys.dev</p>
                    )}
                    <button
                      onClick={handleSendFreeEmail}
                      disabled={freeSending || !freeSubject.trim() || !freeBody.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25 border border-yellow-400/25 disabled:opacity-40"
                    >
                      {freeSending ? <><Loader2 size={14} className="animate-spin" />Envoi…</> : <><Send size={14} />Envoyer à tous</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI MODE */}
            {emailMode === "ai" && (
              <div className="space-y-5">
                <div className="glass rounded-2xl p-4 border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Newsletter IA quotidienne</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      L'IA génère une story sur les matchs du jour · Envoyée via Resend depuis noreply@dmathys.dev
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleGenerateNewsletter}
                  disabled={nlGenerating}
                  className="w-full glass rounded-2xl p-5 flex items-center justify-between hover:bg-white/8 transition-all disabled:opacity-50 border border-purple-500/25"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={20} className="text-purple-400" />
                    <div className="text-left">
                      <p className="font-bold text-white text-sm">Générer avec l'IA</p>
                      <p className="text-xs text-white/40">Analyse les matchs du jour et rédige une newsletter</p>
                    </div>
                  </div>
                  {nlGenerating ? (
                    <Loader2 size={18} className="animate-spin text-purple-400" />
                  ) : (
                    <span className="text-xs text-purple-400 font-semibold bg-purple-500/15 px-3 py-1 rounded-full border border-purple-500/25">Générer →</span>
                  )}
                </button>

                {nlDraft && (
                  <div className="glass rounded-2xl overflow-hidden border border-white/10">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                      <p className="font-bold text-white text-sm flex items-center gap-2">
                        <Mail size={15} className="text-blue-400" />
                        Brouillon généré
                      </p>
                      <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1">
                        <button onClick={() => setNlPreviewMode("edit")}
                          className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                            nlPreviewMode === "edit" ? "bg-white/12 text-white" : "text-white/40 hover:text-white")}>
                          <Pencil size={11} /> Éditer
                        </button>
                        <button onClick={() => setNlPreviewMode("preview")}
                          className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                            nlPreviewMode === "preview" ? "bg-white/12 text-white" : "text-white/40 hover:text-white")}>
                          <Eye size={11} /> Aperçu
                        </button>
                      </div>
                    </div>

                    {nlPreviewMode === "edit" ? (
                      <div className="p-5 space-y-5">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Sujet</label>
                            <input type="text" value={nlDraft.subject} onChange={(e) => setNlDraft({ ...nlDraft, subject: e.target.value })} className="input-field text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Titre hero</label>
                            <input type="text" value={nlDraft.headline} onChange={(e) => setNlDraft({ ...nlDraft, headline: e.target.value })} className="input-field text-sm font-bold" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Intro</label>
                            <textarea value={nlDraft.intro} onChange={(e) => setNlDraft({ ...nlDraft, intro: e.target.value })} rows={3} className="input-field text-sm w-full resize-none" />
                          </div>
                        </div>
                        {nlDraft.articles.map((article, i) => (
                          <div key={i} className="bg-white/4 rounded-2xl p-4 space-y-3 border border-white/8">
                            <div>
                              <label className="text-xs text-white/30 block mb-1">Titre</label>
                              <input type="text" value={article.title}
                                onChange={(e) => { const a = [...nlDraft.articles]; a[i] = { ...a[i], title: e.target.value }; setNlDraft({ ...nlDraft, articles: a }); }}
                                className="input-field text-sm font-semibold w-full" />
                            </div>
                            <div>
                              <label className="text-xs text-white/30 block mb-1">Corps</label>
                              <textarea value={article.content}
                                onChange={(e) => { const a = [...nlDraft.articles]; a[i] = { ...a[i], content: e.target.value }; setNlDraft({ ...nlDraft, articles: a }); }}
                                rows={8} className="input-field text-sm w-full resize-y font-mono leading-relaxed" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4"><PreviewIframe draft={nlDraft} /></div>
                    )}

                    <div className="flex items-center justify-between px-5 py-4 border-t border-white/8 bg-white/3">
                      <div>
                        {nlSentCount !== null ? (
                          <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5"><CheckCircle2 size={13} />Envoyée à {nlSentCount} participants</p>
                        ) : (
                          <p className="text-xs text-white/30">{users.length} destinataires</p>
                        )}
                      </div>
                      <button onClick={handleSendNewsletter} disabled={nlSending || nlSentCount !== null}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 disabled:opacity-50">
                        {nlSending ? <><Loader2 size={14} className="animate-spin" />Envoi…</> : nlSentCount !== null ? <><CheckCircle2 size={14} />Envoyée !</> : <><Send size={14} />Envoyer à tous</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PARTICIPANTS ── */}
        {activeTab === "users" && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <p className="text-sm font-bold text-white">{users.length} participants inscrits</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8 text-xs font-semibold text-white/40 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Pseudo</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="text-center px-4 py-3 hidden sm:table-cell">Pronos</th>
                  <th className="text-right px-4 py-3">Points</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid} className="border-b border-white/5 last:border-0 hover:bg-white/4">
                    <td className="px-4 py-3 font-semibold text-white">{u.pseudo}</td>
                    <td className="px-4 py-3 text-white/50 text-sm hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 text-center text-white/50 text-sm hidden sm:table-cell">{u.predictionsCount}</td>
                    <td className="px-4 py-3 text-right font-black text-white">{u.totalPoints}</td>
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

function PreviewIframe({ draft }: { draft: NLDraft }) {
  const html = buildNewsletterHtml(
    draft,
    typeof window !== "undefined" ? window.location.origin : ""
  );
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
