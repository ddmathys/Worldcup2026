"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Save, Lock, Clock, CheckCircle2, Star, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { savePrediction } from "@/lib/firestore";
import { getMaxPoints } from "@/lib/scoring";
import type { Match, Prediction } from "@/types";
import StatusBadge from "./StatusBadge";
import FlagImage from "./FlagImage";
import clsx from "clsx";

const AI_METHOD_LABELS: Record<string, string> = {
  ai: "IA libre",
  fifa: "FIFA",
  betting: "Cotes",
  form: "Forme",
  chaos: "Chaos",
};

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  userId: string;
  onSaved?: () => void;
  onAiGenerate?: () => Promise<void>;
  aiGenerating?: boolean;
}

type VisualStatus = "open" | "soon" | "locked" | "live" | "finished";

function computeStatus(match: Match): VisualStatus {
  if (match.isFinished) return "finished";
  const now = new Date();
  if (now >= match.kickoffUtc) return "live";
  if (now >= match.lockAtUtc) return "locked";
  if (match.kickoffUtc.getTime() - now.getTime() <= 4 * 3600 * 1000) return "soon";
  return "open";
}

export default function MatchCard({ match, prediction, userId, onSaved, onAiGenerate, aiGenerating = false }: MatchCardProps) {
  const status = computeStatus(match);
  const isEditable = status === "open" || status === "soon";
  const isKnockout = match.phase !== "group";

  const [homeVal, setHomeVal] = useState(
    prediction?.predictedHomeScore != null ? String(prediction.predictedHomeScore) : ""
  );
  const [awayVal, setAwayVal] = useState(
    prediction?.predictedAwayScore != null ? String(prediction.predictedAwayScore) : ""
  );
  const [qualifiedId, setQualifiedId] = useState(prediction?.predictedQualifiedTeamId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHomeVal(prediction?.predictedHomeScore != null ? String(prediction.predictedHomeScore) : "");
    setAwayVal(prediction?.predictedAwayScore != null ? String(prediction.predictedAwayScore) : "");
    setQualifiedId(prediction?.predictedQualifiedTeamId ?? "");
  }, [prediction?.id, prediction?.predictedHomeScore, prediction?.predictedAwayScore, prediction?.predictedQualifiedTeamId]);

  const isDraw = homeVal !== "" && homeVal === awayVal;

  async function handleSave() {
    const h = parseInt(homeVal);
    const a = parseInt(awayVal);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast.error("Score invalide");
      return;
    }
    // Phase finale : on enregistre l'équipe qualifiée. Si le score n'est pas nul,
    // c'est le vainqueur ; en cas de nul (t.a.b.), il faut la choisir.
    let finalQualifiedId: string | null = null;
    if (isKnockout) {
      if (h !== a) {
        finalQualifiedId = h > a ? match.homeTeam.id : match.awayTeam.id;
      } else if (qualifiedId) {
        finalQualifiedId = qualifiedId;
      } else {
        toast.error("Choisis l'équipe qualifiée aux tirs au but");
        return;
      }
    }
    setSaving(true);
    try {
      await savePrediction(userId, match.id, match.lockAtUtc, h, a, finalQualifiedId);
      toast.success("Pronostic enregistré !");
      onSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const maxPts = getMaxPoints(match.phase);
  const hasPrediction = prediction?.predictedHomeScore != null && prediction?.predictedAwayScore != null;
  const pts = prediction?.pointsAwarded;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "glass rounded-xl overflow-hidden transition-all duration-200",
        isEditable && "hover:border-white/20 hover:-translate-y-0.5 hover:shadow-lg",
        status === "live" && "border-blue-500/30"
      )}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
        <div className="flex items-center gap-2 text-xs text-white/40">
          {match.groupCode ? (
            <span className="font-semibold text-white/60">Gr. {match.groupCode}</span>
          ) : (
            <span className="font-semibold text-yellow-400/70 uppercase text-[10px]">
              {match.phase === "r32" ? "Tour" : match.phase === "r16" ? "Huitièmes" : match.phase === "qf" ? "Quarts" : match.phase === "sf" ? "Demies" : "Finale"}
            </span>
          )}
          <span className="opacity-40">·</span>
          <Clock size={10} />
          <span>{format(match.kickoffUtc, "d MMM · HH:mm", { locale: fr })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {prediction?.isAiGenerated && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Sparkles size={8} />
              {AI_METHOD_LABELS[prediction.aiMethod ?? "ai"] ?? "IA"}
            </span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Main row */}
      <div className="px-3 py-3 flex items-center gap-2">
        {/* Home */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <FlagImage code={match.homeTeam.code} name={match.homeTeam.name} size={28} />
          <span className="text-sm font-semibold text-white truncate leading-tight">
            {match.homeTeam.name}
          </span>
        </div>

        {/* Score area */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          {status === "finished" && match.homeScore !== null ? (
            <div className="flex flex-col items-center gap-1">
              {hasPrediction && (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white/40 w-5 text-center">{prediction!.predictedHomeScore}</span>
                  <span className="text-white/20 text-[10px]">–</span>
                  <span className="text-xs font-bold text-white/40 w-5 text-center">{prediction!.predictedAwayScore}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-white w-7 text-center">{match.homeScore}</span>
                <span className="text-white/25 font-bold text-sm">–</span>
                <span className="text-2xl font-black text-white w-7 text-center">{match.awayScore}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={0} max={20} value={homeVal}
                onChange={(e) => setHomeVal(e.target.value)}
                disabled={!isEditable}
                className="w-11 h-11 text-center text-lg font-black bg-white/5 border border-white/15 rounded-lg text-white outline-none transition-all focus:border-yellow-400 focus:bg-yellow-400/10 focus:ring-1 focus:ring-yellow-400/25 disabled:opacity-40 disabled:cursor-not-allowed"
                placeholder="–"
              />
              <span className="text-white/25 font-bold text-sm">–</span>
              <input
                type="number" min={0} max={20} value={awayVal}
                onChange={(e) => setAwayVal(e.target.value)}
                disabled={!isEditable}
                className="w-11 h-11 text-center text-lg font-black bg-white/5 border border-white/15 rounded-lg text-white outline-none transition-all focus:border-yellow-400 focus:bg-yellow-400/10 focus:ring-1 focus:ring-yellow-400/25 disabled:opacity-40 disabled:cursor-not-allowed"
                placeholder="–"
              />
            </div>
          )}

          {/* Points pill */}
          {pts != null && (
            <div className={clsx(
              "flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full",
              pts === maxPts ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                : pts > 0 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/8 text-white/35"
            )}>
              {pts === maxPts && <Star size={9} />}
              {pts} pt{pts !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 flex items-center gap-2 min-w-0 flex-row-reverse">
          <FlagImage code={match.awayTeam.code} name={match.awayTeam.name} size={28} />
          <span className="text-sm font-semibold text-white truncate leading-tight text-right">
            {match.awayTeam.name}
          </span>
        </div>
      </div>

      {/* Sélecteur d'équipe qualifiée — en cas de nul prédit (décidé aux t.a.b.) */}
      {isKnockout && isEditable && isDraw && (
        <div className="px-3 pb-2">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <p className="text-[10px] text-white/40 mb-1.5 text-center">Qualifié aux tirs au but (+2 pts) :</p>
            <div className="flex gap-1.5">
              {[match.homeTeam, match.awayTeam].map((team) => (
                <button key={team.id} onClick={() => setQualifiedId(team.id)}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    qualifiedId === team.id ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/40" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                  )}>
                  <FlagImage code={team.code} name={team.name} size={16} />
                  {team.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {(isEditable || (!isEditable && status !== "live" && status !== "finished")) && (
        <div className="flex items-center justify-between px-3 pb-2.5">
          <span className="text-[10px] text-white/25 flex items-center gap-1">
            {isEditable ? (
              <><Clock size={9} />jusqu'à {format(match.lockAtUtc, "d MMM HH:mm", { locale: fr })}</>
            ) : (
              <><Lock size={9} className="text-red-400/60" /><span className="text-red-400/60">Verrouillé</span></>
            )}
          </span>
          {isEditable && (
            <div className="flex items-center gap-1.5">
              {onAiGenerate && (
                <button
                  onClick={onAiGenerate}
                  disabled={aiGenerating || saving}
                  title="Générer avec l'IA"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-purple-500/15 text-purple-300 border border-purple-500/25 hover:bg-purple-500/25 disabled:opacity-40"
                >
                  {aiGenerating
                    ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    : <Sparkles size={11} />}
                  IA
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || homeVal === "" || awayVal === "" || (isKnockout && isDraw && !qualifiedId)}
                className={clsx(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40",
                  hasPrediction
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                    : "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/30"
                )}
              >
                {saving ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  : hasPrediction ? <CheckCircle2 size={11} /> : <Save size={11} />}
                {hasPrediction ? "Modifier" : "Enregistrer"}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
