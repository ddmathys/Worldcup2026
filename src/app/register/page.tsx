"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Trophy, Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (pseudo.trim().length < 2) {
      setError("Le pseudo doit contenir au moins 2 caractères.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, pseudo.trim());
      router.push("/predictions");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("email-already-in-use")) {
        setError("Cet email est déjà utilisé.");
      } else {
        setError("Erreur lors de la création du compte.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Orbs */}
      <div className="orb w-96 h-96 bg-emerald-500 top-[-80px] left-[-80px] opacity-10 animate-float-slow" />
      <div className="orb w-64 h-64 bg-yellow-400 bottom-[-60px] right-[-60px] opacity-8 animate-float" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
            <Trophy size={20} className="text-black" />
          </div>
          <span className="text-2xl font-black text-white">
            WC<span className="text-gold">2026</span>
          </span>
        </Link>

        <div className="glass rounded-3xl p-8">
          <h1 className="text-2xl font-black text-white mb-1">Rejoindre le jeu</h1>
          <p className="text-white/50 text-sm mb-8">
            Crée ton compte gratuitement et commence à pronostiquer.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">
                Pseudo
              </label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  required
                  className="input-field pl-11"
                  placeholder="MonPseudo"
                  maxLength={30}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field pl-11"
                  placeholder="ton@email.com"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">
                Mot de passe
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pl-11 pr-11"
                  placeholder="Minimum 6 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Créer mon compte
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-white/30 mt-6">
            Jeu gratuit · Sans argent · Juste entre amis
          </p>
        </div>

        <p className="text-center text-sm text-white/40 mt-6">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-yellow-400 font-semibold hover:text-yellow-300">
            Se connecter
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
