"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import MatchCard from "@/components/MatchCard";
import { subscribeMatches, subscribeUserPredictions, savePrediction } from "@/lib/firestore";
import type { Match, Prediction } from "@/types";
import toast from "react-hot-toast";
import { Search, SlidersHorizontal, Loader2, Sparkles, Bot } from "lucide-react";
import clsx from "clsx";

type PhaseFilter = "all" | "group" | "knockout";
type StatusFilter = "all" | "open" | "locked" | "finished";

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
  const [aiMethod, setAiMethod] = useState("ai");
  const [aiGenerating, setAiGenerating] = useState(false);

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
    const diff = m.kickoffUtc.getTime() - now.getTime();
    if (diff <= 4 * 3600 * 1000) return "soon";
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

  async function handleAiGenerate() {
    if (!user) return;
    const groupMatches = matches.filter(
      (m) => m.phase === "group" && (groupFilter === "all" || m.groupCode === groupFilter)
    );
    const openMatches = groupMatches.filter((m) => {
      const s = computeStatus(m);
      return s === "open" || s === "soon";
    });
    if (openMatches.length === 0) {
      toast.error("Aucun match ouvert à pronostiquer dans ce groupe.");
      return;
    }

    const alreadyPredicted = openMatches.filter((m) => predictions.has(m.id));
    if (alreadyPredicted.length > 0) {
      const confirmed = confirm(
        `${alreadyPredicted.length} match(s) ont déjà un pronostic. Écraser et regénérer avec l'IA ?`
      );
      if (!confirmed) return;
    }

    // Group by groupCode for separate API calls
    const byGroup = new Map<string, Match[]>();
    for (const m of openMatches) {
      const g = m.groupCode!;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(m);
    }

    setAiGenerating(true);
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
          await savePrediction(
            user.uid,
            r.id,
            match.lockAtUtc,
            r.homeScore,
            r.awayScore,
            null,
            true,
            aiMethod
          );
          saved++;
        }
      } catch (e) {
        errors.push(`Gr. ${groupCode}: ${e instanceof Error ? e.message : "erreur"}`);
      }
    }

    setAiGenerating(false);
    if (errors.length > 0) {
      toast.error(errors.join(" · "));
    } else {
      toast.success(`${saved} pronostic${saved > 1 ? "s" : ""} IA enregistré${saved > 1 ? "s" : ""} !`);
    }
  }

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
        <div className="space-y-3 mb-8">
          {/* Search */}
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

          {/* Filter row */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
              <SlidersHorizontal size={14} className="text-white/30 ml-2" />
              {(["all", "group", "knockout"] as PhaseFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setPhaseFilter(f)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    phaseFilter === f
                      ? "bg-yellow-400/20 text-yellow-400"
                      : "text-white/50 hover:text-white"
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
                    statusFilter === f
                      ? "bg-yellow-400/20 text-yellow-400"
                      : "text-white/50 hover:text-white"
                  )}
                >
                  {f === "all" ? "Tous" : f === "open" ? "Ouverts" : f === "locked" ? "Verrouillés" : "Terminés"}
                </button>
              ))}
            </div>
          </div>

          {/* Group filter */}
          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setGroupFilter("all")}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  groupFilter === "all" ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30" : "bg-white/5 text-white/40 hover:text-white border border-white/10"
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
                    groupFilter === g ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30" : "bg-white/5 text-white/40 hover:text-white border border-white/10"
                  )}
                >
                  Gr. {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI banner */}
        {!loadingData && matches.filter(m => m.phase === "group").length > 0 && (
          <div className="mb-6 glass rounded-2xl p-4 border border-purple-500/25 bg-purple-500/5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-purple-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Sparkles size={13} className="text-purple-400" />
                  Pronostics assistés par IA
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {groupFilter !== "all"
                    ? `Génère automatiquement les 6 pronostics du Groupe ${groupFilter}`
                    : "Sélectionne un groupe pour générer ses pronostics en un clic"}
                </p>
              </div>
            </div>

            {/* Method pills */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {([
                { key: "ai", label: "IA libre" },
                { key: "fifa", label: "FIFA" },
                { key: "betting", label: "Cotes" },
                { key: "form", label: "Forme" },
                { key: "chaos", label: "Chaos" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAiMethod(key)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                    aiMethod === key
                      ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                      : "bg-white/5 text-white/40 hover:text-white border border-white/10"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating || groupFilter === "all"}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                groupFilter !== "all"
                  ? "bg-purple-500/25 text-purple-300 border border-purple-500/35 hover:bg-purple-500/35"
                  : "bg-white/5 text-white/25 border border-white/10 cursor-default"
              )}
            >
              {aiGenerating ? (
                <><Loader2 size={14} className="animate-spin" />Génération en cours…</>
              ) : groupFilter !== "all" ? (
                <><Sparkles size={14} />Générer le Groupe {groupFilter}</>
              ) : (
                <><Sparkles size={14} />Sélectionne un groupe ci-dessus</>
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
            <div className="text-5xl mb-4">
              {matches.length === 0 ? "📅" : "🔍"}
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {matches.length === 0
                ? "Aucun match disponible"
                : "Aucun match trouvé"}
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
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
