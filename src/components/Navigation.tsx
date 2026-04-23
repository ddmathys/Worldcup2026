"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Trophy, CalendarDays, BarChart3, LayoutGrid, Settings, LogOut, Menu, X, MapPin, TrendingUp } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const NAV_LINKS = [
  { href: "/predictions", label: "Pronostics", icon: CalendarDays },
  { href: "/standings", label: "Poules", icon: TrendingUp },
  { href: "/leaderboard", label: "Classement", icon: BarChart3 },
  { href: "/bracket", label: "Tableau", icon: LayoutGrid },
  { href: "/venues", label: "Stades", icon: MapPin },
];

export default function Navigation() {
  const { user, profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/8 bg-navy/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
            <Trophy size={16} className="text-black" />
          </div>
          <span className="font-black text-white hidden sm:block group-hover:text-gold transition-colors">
            WC<span className="text-gold">2026</span>
          </span>
        </Link>

        {/* Desktop nav */}
        {user && (
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  pathname === href
                    ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/25"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className={clsx(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  pathname === "/admin"
                    ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/25"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                )}
              >
                <Settings size={15} />
                Admin
              </Link>
            )}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-white leading-none">
                    {profile?.pseudo ?? ""}
                  </p>
                  <p className="text-xs text-yellow-400 font-bold mt-0.5">
                    {profile?.totalPoints ?? 0} pts
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
                  title="Déconnexion"
                >
                  <LogOut size={16} />
                </button>
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 rounded-xl text-white/60 hover:bg-white/10 transition-all"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn-outline text-sm py-2 px-4">
                Connexion
              </Link>
              <Link href="/register" className="btn-gold text-sm py-2 px-4">
                Rejoindre
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/8 bg-navy/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    pathname === href
                      ? "bg-yellow-400/15 text-yellow-400"
                      : "text-white/60 hover:text-white hover:bg-white/8"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
              {profile?.role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-all"
                >
                  <Settings size={16} />
                  Admin
                </Link>
              )}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 mt-2">
                <div>
                  <p className="text-sm font-semibold text-white">{profile?.pseudo}</p>
                  <p className="text-xs text-yellow-400">{profile?.totalPoints ?? 0} pts</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
                >
                  <LogOut size={14} />
                  Déconnexion
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
