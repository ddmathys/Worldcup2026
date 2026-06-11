# WC2026 Score Assistant — Claude Code Context

## Vue d'ensemble du projet

Outil IA de génération de pronostics pour la Coupe du Monde 2026, conçu pour le site **worldcup2026friend.com** (jeu de pronostics entre amis, gratuit, sans paris d'argent).

**Problème résolu** : les utilisateurs ne prennent pas le temps de remplir manuellement leurs 104 pronostics. Cet outil génère des scores cohérents via l'API Claude, avec plusieurs approches au choix.

---

## Architecture actuelle

### Stack
- **Frontend** : React 18 (via CDN unpkg), rendu dans un artifact Claude.ai
- **IA** : API Anthropic `/v1/messages`, modèle `claude-sonnet-4-20250514`
- **Pas de backend** : tout tourne côté client, clé API gérée par le contexte Claude.ai

### Structure des données

```js
// Un match
{
  id: "I1",           // groupe + numéro (ex: "I1" = Groupe I, match 1)
  group: "I",
  teamA: "France",    flagA: "🇫🇷",
  teamB: "Sénégal",   flagB: "🇸🇳",
  scoreA: null,       // null = non rempli, number = score généré ou saisi
  scoreB: null,
  note: null,         // justification courte générée par l'IA (≤8 mots)
}
```

### Groupes WC2026 (draw du 5 décembre 2025)

| Groupe | Équipes |
|--------|---------|
| A | Mexique 🇲🇽, Afrique du Sud 🇿🇦, Corée du Sud 🇰🇷, Tchéquie 🇨🇿 |
| B | Canada 🇨🇦, Suisse 🇨🇭, Qatar 🇶🇦, Bosnie-Herzégovine 🇧🇦 |
| C | Brésil 🇧🇷, Maroc 🇲🇦, Haïti 🇭🇹, Écosse 🏴󠁧󠁢󠁳󠁣󠁴󠁿 |
| D | USA 🇺🇸, Paraguay 🇵🇾, Australie 🇦🇺, Türkiye 🇹🇷 |
| E | Allemagne 🇩🇪, Curaçao 🇨🇼, Côte d'Ivoire 🇨🇮, Équateur 🇪🇨 |
| F | Pays-Bas 🇳🇱, Japon 🇯🇵, Suède 🇸🇪, Tunisie 🇹🇳 |
| G | Belgique 🇧🇪, Égypte 🇪🇬, Iran 🇮🇷, Nouvelle-Zélande 🇳🇿 |
| H | Espagne 🇪🇸, Cap-Vert 🇨🇻, Arabie Saoudite 🇸🇦, Uruguay 🇺🇾 |
| I | France 🇫🇷, Sénégal 🇸🇳, Norvège 🇳🇴, Irak 🇮🇶 |
| J | Argentine 🇦🇷, Algérie 🇩🇿, Autriche 🇦🇹, Jordanie 🇯🇴 |
| K | Portugal 🇵🇹, RD Congo 🇨🇩, Ouzbékistan 🇺🇿, Colombie 🇨🇴 |
| L | Angleterre 🏴󠁧󠁢󠁥󠁮󠁧󠁿, Croatie 🇭🇷, Ghana 🇬🇭, Panama 🇵🇦 |

72 matchs de poules générés automatiquement (6 matchs × 12 groupes).

### Classement FIFA avril 2026 (pour context IA)
1. France · 2. Espagne · 3. Argentine · 4. Angleterre · 5. Portugal  
6. Brésil · 7. Pays-Bas · 8. Maroc · 9. Belgique · 10. Allemagne

---

## Méthodes de génération (6 au total)

Chaque méthode envoie un prompt différent à l'API Claude :

| ID | Label | Logique |
|----|-------|---------|
| `fifa` | Classement FIFA | Pondéré par le classement FIFA avril 2026 |
| `betting` | Cotes de paris | Simule bookmakers : 55% favori, 25% nul, 20% upset |
| `polymarket` | Polymarket | Marchés prédictifs efficients, inclut % dans la note |
| `form` | Forme actuelle | Performances 2025-2026, momentum pré-tournoi |
| `chaos` | Mode chaos | Upsets encouragés, scores improbables mais réalistes |
| `ai` | IA libre | Meilleur jugement analytique global (défaut) |

### Format de l'appel API

```js
// Prompt envoyé pour un groupe
const prompt = `Expert football analyst for FIFA World Cup 2026, Group ${g}.
Method: "${method.label}". Instructions: ${method.prompt}

Return ONLY valid JSON array, no markdown:
[{"id":"I1","scoreA":N,"scoreB":N,"note":"≤8 words in French"},…]

Matches: ${JSON.stringify(matchList)}`;

fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  }),
});
```

### Parsing de la réponse

```js
const text = data.content.map(b => b.text || "").join("")
  .replace(/```json|```/g, "").trim();
const results = JSON.parse(text);
// results = [{ id, scoreA, scoreB, note }, ...]
```

---

## Fonctionnalités actuelles

- [x] 72 matchs pré-chargés (phase de groupes WC2026, groupes réels)
- [x] Vue d'ensemble : 12 cartes de groupe avec statut de complétion
- [x] Vue détaillée par groupe : 6 cartes de match avec inputs éditables
- [x] Classement provisoire calculé en temps réel (pts, GD, GF)
- [x] Génération par groupe (1 appel API = 6 matchs)
- [x] "Générer tous les groupes" : 12 appels API séquentiels
- [x] Édition manuelle des scores après génération
- [x] Copie de tous les résultats en texte formaté
- [x] Reset par groupe ou global
- [x] Indicateur de progression (barre + compteur)
- [x] État de chargement visible par groupe (point pulsant sur l'onglet)
- [x] Gestion des erreurs API avec message utilisateur

---

## Améliorations prioritaires

### P0 — Intégration worldcup2026friend.com
- [ ] Étudier l'API du site (si elle existe) pour pré-remplir les pronostics automatiquement
- [ ] Sinon : export en JSON / CSV compatible avec une éventuelle import
- [ ] Bookmarklet ou extension Chrome pour injecter les scores directement dans le formulaire du site

### P1 — Phase éliminatoire
- [ ] Ajouter les matchs à partir du Tableau des 32 (Round of 32 → Finale)
- [ ] Logique de qualification depuis les poules (top 2 + 8 meilleurs 3es)
- [ ] Le tirage des 32es dépend des résultats de poule — nécessite que les poules soient remplies d'abord

### P2 — UX
- [ ] Persistance locale (`localStorage`) pour ne pas perdre les scores entre sessions
- [ ] Bouton "Regénérer ce match" sur chaque carte (sans écraser le reste)
- [ ] Comparaison de deux méthodes côte à côte
- [ ] Export PDF ou image de tous les pronostics (pour partager)
- [ ] Ajouter les cotes réelles depuis une API bookmaker (ex: The Odds API)

### P3 — Données temps réel
- [ ] Intégrer les vraies cotes de paris via `api.the-odds-api.com`
- [ ] Récupérer les données Polymarket si une API publique est disponible
- [ ] Mise à jour automatique du classement FIFA (API FIFA officielle ou scraping)

---

## Contraintes techniques

- **max_tokens: 1000** — limite imposée par le contexte Claude.ai artifacts
- **Pas de localStorage** dans les artifacts Claude.ai (sandboxé) — utiliser React state
- **CSP stricte** : seuls `cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, `unpkg.com` sont autorisés
- La clé API Anthropic est injectée automatiquement dans le contexte artifact — ne jamais la hardcoder
- Les flags emoji sont supportés dans les prompts — pas besoin de les stripper

## Style & Design

Design system : **claude.ai design system** (CSS variables `--color-*`, `--font-sans`, `--border-radius-*`).  
Icônes : **Tabler Icons outline** (classe `ti ti-name`, outline uniquement, jamais `-filled`).  
Typo : 2 graisses max (400 regular, 500 bold). Sentence case partout.  
Compatible light/dark mode via CSS variables.
