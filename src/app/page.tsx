"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import CountdownTimer from "@/components/CountdownTimer";
import { Trophy, Users, CalendarDays, ChevronRight, Star, Zap, Sparkles } from "lucide-react";

const FIRST_MATCH = new Date("2026-06-11T20:00:00Z");

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" },
  }),
};

const SCORING_RULES = [
  {
    phase: "Phase de poules",
    exact: "3 pts",
    winner: "1 pt",
    winnerLabel: "Bon résultat",
    winnerNote: "vainqueur correct, ou nul prédit + vrai nul",
    icon: "⚽",
  },
  {
    phase: "Phases finales",
    exact: "6 pts",
    winner: "2 pts",
    winnerLabel: "Bon qualifié",
    winnerNote: null,
    icon: "🏆",
  },
  {
    phase: "Finale",
    exact: "12 pts",
    winner: "3 pts",
    winnerLabel: "Bon qualifié",
    winnerNote: null,
    icon: "👑",
  },
];

export default function HomePage() {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-navy overflow-hidden">
      {/* ── Hero ─────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-16">
        {/* Orbs */}
        <div className="orb w-[500px] h-[500px] bg-yellow-400 top-[-100px] left-[-150px] opacity-10 animate-float" />
        <div className="orb w-[400px] h-[400px] bg-emerald-500 bottom-[-50px] right-[-100px] opacity-8 animate-float-slow" />
        <div className="orb w-[300px] h-[300px] bg-blue-500 top-[30%] right-[10%] opacity-6 animate-float-slower" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-yellow-400/20 text-yellow-400 text-sm font-semibold mb-8"
          >
            <Zap size={14} />
            USA · Canada · Mexique · 11 juin 2026
          </motion.div>

          {/* Title */}
          <motion.h1
            custom={1}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="text-6xl sm:text-7xl md:text-8xl font-black leading-none mb-4"
          >
            <span className="text-white">WORLD</span>
            <br />
            <span className="text-gold">CUP 2026</span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="text-lg sm:text-xl text-white/50 mb-10 max-w-xl mx-auto"
          >
            Le jeu de pronostics gratuit entre amis pour la Coupe du Monde 2026.
            Pronostiquez, gagnez des points, dominez le classement.
          </motion.p>

          {/* CTA */}
          <motion.div
            custom={3}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            {user ? (
              <Link href="/predictions" className="btn-gold text-base flex items-center gap-2">
                <CalendarDays size={18} />
                Mes pronostics
                <ChevronRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn-gold text-base flex items-center gap-2">
                  <Trophy size={18} />
                  Rejoindre le jeu
                  <ChevronRight size={16} />
                </Link>
                <Link href="/login" className="btn-outline text-base">
                  J'ai déjà un compte
                </Link>
              </>
            )}
          </motion.div>

          {/* Countdown */}
          <motion.div
            custom={4}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="flex flex-col items-center gap-4"
          >
            <p className="text-sm text-white/40 font-medium uppercase tracking-widest">
              Coup d'envoi dans
            </p>
            <CountdownTimer target={FIRST_MATCH} />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/20"
        >
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/20" />
          <div className="w-1 h-1 rounded-full bg-white/20" />
        </motion.div>
      </section>

      {/* ── Stats strip ─────────────────────── */}
      <section className="py-16 px-4 border-y border-white/8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: "🏟️", value: "104", label: "Matchs à pronostiquer" },
            { icon: "🌍", value: "48", label: "Nations qualifiées" },
            { icon: "🗺️", value: "16", label: "Stades aux USA, Canada & Mexique" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div className="text-3xl font-black text-gold mb-1">{stat.value}</div>
              <div className="text-sm text-white/50">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── AI Feature ───────────────────────── */}
      <section className="py-20 px-4 border-t border-white/8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-8 sm:p-12 border border-purple-500/20 bg-purple-500/5 flex flex-col sm:flex-row items-center gap-8"
          >
            <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-purple-500/20 flex items-center justify-center">
              <Sparkles size={36} className="text-purple-400" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-300 text-xs font-semibold mb-3">
                <Sparkles size={11} />
                Nouveau — Pronostics IA
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
                104 matchs à pronostiquer ?{" "}
                <span className="text-purple-400">L'IA le fait pour toi.</span>
              </h2>
              <p className="text-white/50 text-sm sm:text-base mb-4 max-w-xl">
                Sélectionne une poule, choisis une méthode (classement FIFA, cotes de paris, forme du moment…)
                et l'IA génère tes pronostics en quelques secondes. Tu peux ensuite les modifier à ta guise.
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {["IA libre", "Classement FIFA", "Cotes paris", "Forme actuelle", "Mode chaos"].map((m) => (
                  <span key={m} className="px-2.5 py-1 rounded-lg bg-white/8 text-white/50 text-xs font-semibold border border-white/10">
                    {m}
                  </span>
                ))}
              </div>
            </div>
            {user && (
              <Link href="/predictions" className="flex-shrink-0 btn-gold text-sm flex items-center gap-2">
                <Sparkles size={15} />
                Essayer
                <ChevronRight size={14} />
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Scoring rules ────────────────────── */}
      <section className="py-20 px-4 border-t border-white/8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-black text-white mb-3">
              Règles de <span className="text-gold">points</span>
            </h2>
            <p className="text-white/50">
              Plus le pronostic est précis, plus vous gagnez de points.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SCORING_RULES.map((rule, i) => (
              <motion.div
                key={rule.phase}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`glass rounded-2xl p-6 text-center ${
                  i === 2 ? "border-yellow-400/25 bg-yellow-400/5" : ""
                }`}
              >
                <div className="text-4xl mb-3">{rule.icon}</div>
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
                  {rule.phase}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50 flex items-center gap-1.5">
                      <Star size={12} className="text-yellow-400" />
                      Score exact
                    </span>
                    <span className="font-black text-gold text-lg">{rule.exact}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50 flex flex-col items-start gap-0.5">
                      {rule.winnerLabel}
                      {rule.winnerNote && (
                        <span className="text-[10px] text-white/30 leading-tight">{rule.winnerNote}</span>
                      )}
                    </span>
                    <span className="font-bold text-emerald-400 ml-3 shrink-0">{rule.winner}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50">Mauvais pronostic</span>
                    <span className="font-bold text-white/30">0 pt</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────── */}
      <section className="py-20 px-4 border-t border-white/8">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-black text-white text-center mb-12"
          >
            Comment ça <span className="text-gold">marche ?</span>
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: "👤",
                title: "Inscris-toi",
                desc: "Crée ton compte gratuitement en 30 secondes.",
              },
              {
                icon: "⚽",
                title: "Pronostique",
                desc: "Saisie tes scores avant le coup d'envoi de chaque match.",
              },
              {
                icon: "🔒",
                title: "Verrouillage auto",
                desc: "Les pronostics se verrouillent 1h avant chaque match.",
              },
              {
                icon: "🏆",
                title: "Gagne des points",
                desc: "Les points sont calculés automatiquement. Vise la 1ère place !",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/50">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────── */}
      {!user && (
        <section className="py-24 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="glass rounded-3xl p-12 border border-yellow-400/15"
            >
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-4xl font-black text-white mb-4">
                Prêt à jouer ?
              </h2>
              <p className="text-white/50 mb-8">
                Rejoins le jeu gratuit entre amis pour la Coupe du Monde 2026.
              </p>
              <Link href="/register" className="btn-gold text-base inline-flex items-center gap-2">
                <Users size={18} />
                Créer mon compte gratuitement
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/8 text-center text-sm text-white/25">
        <p>
          WC2026 Pronostics · Jeu gratuit entre amis · Pas de paris d'argent
        </p>
      </footer>
    </div>
  );
}
