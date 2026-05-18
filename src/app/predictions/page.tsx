"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import MatchCard from "@/components/MatchCard";
import { subscribeMatches, subscribeUserPredictions, savePrediction } from "@/lib/firestore";
import type { Match, Prediction } from "@/types";
import toast from "react-hot-toast";
import { Search, SlidersHorizontal, Loader2, Sparkles, Bot, X } from "lucide-react";
import clsx from "clsx";

type PhaseFilter = "all" | "group" | "knockout";
type StatusFilter = "all" | "open" | "locked" | "finished";

const AI_METHODS = [
  {
    key: "ai",
    label: "IA libre",
    description: "L'IA combine toutes les sources disponibles — classement FIFA, forme récente, historique des confrontations, dynamique de groupe et conditions du tournoi — pour produire le pronostic le plus équilibré et analytiquement solide possible. C'est le mode recommandé si tu veux des prédictions réalistes et argumentées.",
  },
  {
    key: "fifa",
    label: "Classement FIFA",
    description: "Les pronostics sont pondérés strictement selon le classement FIFA d'avril 2026. Plus l'écart de classement est grand, plus le favori gagne nettement. Les équipes bien classées (France #1, Espagne #2, Argentine #3…) dominent. Peu d'upsets, résultats logiques et prévisibles.",
  },
  {
    key: "betting",
    label: "Cotes paris",
    description: "L'IA simule le raisonnement des bookmakers : environ 55% de chance de victoire pour le favori, 25% de match nul, 20% d'upset. Les cotes reflètent l'opinion collective du marché, intégrant blessures, suspensions et momentum récent. Idéal pour des pronostics proches de ce que parieraient les professionnels.",
  },
  {
    key: "form",
    label: "Forme actuelle",
    description: "Seules les performances de 2025-2026 comptent : résultats en qualifications, Nations League, matchs amicaux récents et blessures en cours. Une équipe historiquement forte mais en méforme sera pénalisée. À l'inverse, une équipe en feu peut créer la surprise. Le momentum pré-tournoi prime sur la réputation.",
  },
  {
    key: "chaos",
    label: "Mode chaos",
    description: "L'IA est instructée de favoriser les résultats surprenants : upsets fréquents, scores élevés, nuls inattendus. Les outsiders gagnent plus souvent que la logique ne le voudrait. Parfait si tu veux te démarquer du peloton avec des pronostics audacieux — ou si tu penses que la Coupe du Monde 2026 réserve des surprises !",
  },
] as const;

type AiMethodKey = (typeof AI_METHODS)[number]["key"];

interface OverwriteDialog {
  message: string;
  skipLabel?: string;
  onSkip?: () => void;
  onOverwrite: () => void;
}

export default function PredictionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Map<string, Prediction>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [aiMethod, setAiMethod] = useState<AiMethodKey>("ai");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratingMatchId, setAiGeneratingMatchId] = useState<string | null>(null);
  const [overwriteDialog, setOverwriteDialog] = useState<OverwriteDialog | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeMatches((m) => {
      setMatches(m);
      setLoadingData(false);
    });
    const unsub2 = subscribeUserPredictions(user.uid, (preds) => {
      const map = new Map(preds.map((p) => [p.matchId, p]));
      setPredictions(map);
    });
    return () => { unsub1(); unsub2(); };
  }, [user]);

  function computeStatus(m: Match): string {
    if (m.isFinished) return "finished";
    const now = new Date();
    if (now >= m.kickoffUtc) return "live";
    if (now >= m.lockAtUtc) return "locked";
    if (m.kickoffUtc.getTime() - now.getTime() <= 4 * 3600 * 1000) return "soon";
    return "open";
  }

  const groups = Array.from(
    new Set(matches.filter((m) => m.groupCode).map((m) => m.groupCode!))
  ).sort();

  const filtered = matches.filter((m) => {
    if (phaseFilter === "group" && m.phase !== "group") return false;
    if (phaseFilter === "knockout" && m.phase === "group") return false;
    if (statusFilter !== "all") {
      const s = computeStatus(m);
      if (statusFilter === "open" && s !== "open" && s !== "soon") return false;
      if (statusFilter === "locked" && s !== "locked") return false;
      if (statusFilter === "finished" && s !== "finished") return false;
    }
    if (groupFilter !== "all" && m.groupCode !== groupFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !m.homeTeam.name.toLowerCase().includes(q) &&
        !m.awayTeam.name.toLowerCase().includes(q) &&
        !m.city.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const total = matches.length;
  const filled = matches.filter((m) => predictions.has(m.id)).length;

  // ── Core AI generation ────────────────────────────────────────────────────
  async function runAiGeneration(matchesToGenerate: Match[]) {
    if (!user) return;
    setAiGenerating(true);

    // Group by groupCode (or phase for knockout)
    const byGroup = new Map<string, Match[]>();
    for (const m of matchesToGenerate) {
      const g = m.groupCode ?? m.phase;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(m);
    }

    let saved = 0;
    const errors: string[] = [];

    for (const [groupCode, gMatches] of byGroup) {
      try {
        const res = await fetch("/api/ai/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupCode,
            method: aiMethod,
            matches: gMatches.map((m) => ({
              id: m.id,
              homeTeam: m.homeTeam.name,
              awayTeam: m.awayTeam.name,
            })),
          }),
        });
        const json = await res.json() as {
          ok: boolean;
          results?: Array<{ id: string; homeScore: number; awayScore: number }>;
          error?: string;
        };
        if (!json.ok || !json.results) throw new Error(json.error ?? "Erreur IA");

        for (const r of json.results) {
          const match = gMatches.find((m) => m.id === r.id);
          if (!match) continue;
          await savePrediction(user.uid, r.id, match.lockAtUtc, r.homeScore, r.awayScore, null, true, aiMethod);
          saved++;
        }
      } catch (e) {
        errors.push(`${groupCode}: ${e instanceof Error ? e.message : "erreur"}`);
      }
    }

    setAiGenerating(false);
    if (errors.length > 0) {
      toast.error(errors.join(" · "));
    } else {
      toast.success(`${saved} pronostic${saved > 1 ? "s" : ""} IA enregistré${saved > 1 ? "s" : ""} !`);
    }
  }

  // ── Batch generate (current view) ────────────────────────────────────────
  function handleAiGenerate() {
    if (!user) return;
    const scope = groupFilter === "all"
      ? matches
      : matches.filter((m) => m.groupCode === groupFilter);

    const openMatches = scope.filter((m) => {
      const s = computeStatus(m);
      return s === "open" || s === "soon";
    });

    if (openMatches.length === 0) {
      toast.error("Aucun match ouvert dans cette sélection.");
      return;
    }

    const withPreds = openMatches.filter((m) => predictions.has(m.id));

    if (withPreds.length > 0) {
      setOverwriteDialog({
        message: `${withPreds.length} match${withPreds.length > 1 ? "s ont" : " a"} déjà un pronostic.`,
        skipLabel: `Ignorer les ${withPreds.length} existant${withPreds.length > 1 ? "s" : ""}`,
        onSkip: () => {
          setOverwriteDialog(null);
          runAiGeneration(openMatches.filter((m) => !predictions.has(m.id)));
        },
        onOverwrite: () => {
          setOverwriteDialog(null);
          runAiGeneration(openMatches);
        },
      });
    } else {
      runAiGeneration(openMatches);
    }
  }

  // ── Per-match generate ────────────────────────────────────────────────────
  async function handleAiGenerateMatch(match: Match) {
    if (!user) return;

    const doGenerate = async () => {
      setOverwriteDialog(null);
      setAiGeneratingMatchId(match.id);
      await runAiGeneration([match]);
      setAiGeneratingMatchId(null);
    };

    if (predictions.has(match.id)) {
      setOverwriteDialog({
        message: "Ce match a déjà un pronostic.",
        onOverwrite: doGenerate,
      });
    } else {
      await doGenerate();
    }
  }

  const selectedMethod = AI_METHODS.find((m) => m.key === aiMethod)!;

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <Loader2 className="animate-spin text-yellow-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white mb-1">
              Mes <span className="text-gold">Pronostics</span>
            </h1>
            <p className="text-sm text-white/40">
              {filled} / {total} matchs pronostiqués
            </p>
          </div>
          {total > 0 && (
            <div className="glass rounded-2xl px-4 py-3 text-center min-w-[90px]">
              <div className="text-2xl font-black text-gold">{Math.round((filled / total) * 100)}%</div>
              <div className="text-xs text-white/40">complété</div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mb-8 h-2 bg-white/8 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(filled / total) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"
            />
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une équipe ou une ville…"
              className="input-field pl-11"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
              <SlidersHorizontal size={14} className="text-white/30 ml-2" />
              {(["all", "group", "knockout"] as PhaseFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setPhaseFilter(f)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    phaseFilter === f ? "bg-yellow-400/20 text-yellow-400" : "text-white/50 hover:text-white"
                  )}
                >
                  {f === "all" ? "Tous" : f === "group" ? "Poules" : "Phases finales"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
              {(["all", "open", "locked", "finished"] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    statusFilter === f ? "bg-yellow-400/20 text-yellow-400" : "text-white/50 hover:text-white"
                  )}
                >
                  {f === "all" ? "Tous" : f === "open" ? "Ouverts" : f === "locked" ? "Verrouillés" : "Terminés"}
                </button>
              ))}
            </div>
          </div>

          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setGroupFilter("all")}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  groupFilter === "all"
                    ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                    : "bg-white/5 text-white/40 hover:text-white border border-white/10"
                )}
              >
                Tous groupes
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupFilter(g === groupFilter ? "all" : g)}
                  className={clsx(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                    groupFilter === g
                      ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                      : "bg-white/5 text-white/40 hover:text-white border border-white/10"
                  )}
                >
                  Gr. {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI banner */}
        {!loadingData && matches.length > 0 && (
          <div className="mb-6 glass rounded-2xl p-4 border border-purple-500/25 bg-purple-500/5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-purple-400" />
              </div>
              <p className="font-bold text-white text-sm">Pronostics IA</p>
            </div>

            {/* Method selector */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {AI_METHODS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAiMethod(key)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    aiMethod === key
                      ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                      : "bg-white/5 text-white/40 hover:text-white border border-white/10"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Description of selected method */}
            <p className="text-xs text-white/40 mb-4 pl-1 border-l-2 border-purple-500/30">
              {selectedMethod.description}
            </p>

            {/* Generate button */}
            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all bg-purple-500/25 text-purple-300 border border-purple-500/35 hover:bg-purple-500/35 disabled:opacity-50"
            >
              {aiGenerating ? (
                <><Loader2 size={14} className="animate-spin" />Génération en cours…</>
              ) : (
                <>
                  <Sparkles size={14} />
                  {groupFilter !== "all"
                    ? `Générer le Groupe ${groupFilter}`
                    : "Générer tous les matchs ouverts"}
                </>
              )}
            </button>
          </div>
        )}

        {/* Match list */}
        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white/40">Chargement des matchs…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">{matches.length === 0 ? "📅" : "🔍"}</div>
            <h3 className="text-lg font-bold text-white mb-2">
              {matches.length === 0 ? "Aucun match disponible" : "Aucun match trouvé"}
            </h3>
            <p className="text-white/40 text-sm max-w-xs mx-auto">
              {matches.length === 0
                ? "Les matchs seront bientôt chargés par l'administrateur."
                : "Essaie de modifier tes filtres."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <MatchCard
                  match={match}
                  prediction={predictions.get(match.id)}
                  userId={user!.uid}
                  onAiGenerate={() => handleAiGenerateMatch(match)}
                  aiGenerating={aiGeneratingMatchId === match.id}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Overwrite dialog */}
      <AnimatePresence>
        {overwriteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setOverwriteDialog(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-sm border border-white/15"
            >
              <div className="flex items-start justify-between mb-1">
                <p className="font-bold text-white">Pronostics existants</p>
                <button onClick={() => setOverwriteDialog(null)} className="text-white/30 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <p className="text-white/50 text-sm mb-5">{overwriteDialog.message}</p>

              <div className="flex flex-col gap-2">
                {overwriteDialog.skipLabel && overwriteDialog.onSkip && (
                  <button
                    onClick={overwriteDialog.onSkip}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/8 text-white hover:bg-white/12 transition-all border border-white/10"
                  >
                    {overwriteDialog.skipLabel}
                  </button>
                )}
                <button
                  onClick={overwriteDialog.onOverwrite}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-purple-500/25 text-purple-300 hover:bg-purple-500/35 transition-all border border-purple-500/30"
                >
                  {overwriteDialog.skipLabel ? "Tout regénérer" : "Écraser et regénérer"}
                </button>
                <button
                  onClick={() => setOverwriteDialog(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-white transition-all"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
