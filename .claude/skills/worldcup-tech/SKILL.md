---
name: worldcup-tech
description: Spécialiste du fonctionnement technique de World Cup 2026 (stack, données, déploiement, zones sensibles).
---

# Technique de World Cup 2026

## Stack et règles
- Next.js 15 + Firebase (règles firestore.rules) + Resend.
- Déployé par Vercel depuis GitHub (auto-deploy sur main).
- Voir CLAUDE.md pour la structure des matchs/groupes.

## Zones sensibles (jamais de merge automatique)
Règles Firestore/Storage, firebase.json, vercel.json, .github/, android/, fichiers Gradle, package.json, et tout fichier lié à l'authentification, aux sessions, à l'admin, aux secrets, aux paiements ou aux crédits.
