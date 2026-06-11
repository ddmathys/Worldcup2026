export interface KeyPlayer {
  name: string;
  team: string;
  role: string;
}

export interface Article {
  tag: string;
  matchTitle?: string;
  title: string;
  content: string;
  pullQuote: string;
  keyPlayer?: KeyPlayer;
}

export interface StatOfDay {
  number: string;
  unit?: string;
  label: string;
}

export interface MatchRow {
  home: string;
  away: string;
  group: string;
  time: string;
}

export interface NewsletterDraft {
  subject: string;
  preheader: string;
  headline: string;
  intro: string;
  articles: Article[];
  statOfDay?: StatOfDay;
  matchesToday: MatchRow[];
  matchesTomorrow: MatchRow[];
  dateStr: string;
}

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
const TEXT = `color:#1a1a1a;${FONT}`;

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.75;${TEXT}">${text}</p>`;
}

function h2(text: string): string {
  return `<h2 style="margin:24px 0 10px;font-size:18px;font-weight:700;${TEXT}">${text}</h2>`;
}

function hr(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">`;
}

function matchLine(m: MatchRow): string {
  return `<tr>
    <td style="padding:7px 0;font-size:14px;${TEXT}">
      <span style="color:#6b7280;min-width:50px;display:inline-block;">Gr.${m.group}</span>
      <strong>${m.home}</strong> — <strong>${m.away}</strong>
      <span style="color:#6b7280;margin-left:8px;">${m.time}</span>
    </td>
  </tr>`;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildNewsletterHtml(draft: NewsletterDraft, appUrl: string): string {
  const { preheader, headline, intro, articles, statOfDay, matchesToday, matchesTomorrow, dateStr } = draft;

  const hasMatchesToday = matchesToday.length > 0;
  const hasMatchesTomorrow = matchesTomorrow.length > 0;

  const articlesHtml = articles.map((a, i) => `
    ${i > 0 ? hr() : ""}
    ${h2(a.title)}
    ${a.matchTitle ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;${FONT}">⚽ ${a.matchTitle}</p>` : ""}
    ${p(a.content.replace(/\n\n+/g, `</p>${p("")}`))}
    ${a.pullQuote ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #d1d5db;color:#374151;font-style:italic;font-size:15px;${FONT}">${a.pullQuote}</blockquote>` : ""}
    ${a.keyPlayer ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;${FONT}">⚡ <strong>${a.keyPlayer.name}</strong> (${a.keyPlayer.team}) — ${a.keyPlayer.role}</p>` : ""}
  `).join("");

  const matchesTodayHtml = hasMatchesToday ? `
    ${hr()}
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;${FONT}">Matchs aujourd'hui</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${matchesToday.map(matchLine).join("")}
    </table>
  ` : "";

  const matchesTomorrowHtml = hasMatchesTomorrow && !hasMatchesToday ? `
    ${hr()}
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;${FONT}">Matchs demain</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${matchesTomorrow.map(matchLine).join("")}
    </table>
  ` : "";

  const statHtml = statOfDay ? `
    ${hr()}
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280;${FONT}">Le chiffre du jour</p>
    <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:#1a1a1a;${FONT}">${statOfDay.number}${statOfDay.unit ? ` ${statOfDay.unit}` : ""}</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;${FONT}">${statOfDay.label}</p>
  ` : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9fafb;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f9fafb;">${preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;${FONT}">${dateStr} · WC2026 entre amis</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;line-height:1.3;${TEXT}">${headline}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px 8px;">
              ${p(intro)}
              ${articlesHtml}
              ${statHtml}
              ${matchesTodayHtml}
              ${matchesTomorrowHtml}
              ${hr()}
              <p style="margin:0 0 24px;font-size:15px;${TEXT}">
                Tes pronostics t'attendent → <a href="${appUrl}/predictions" style="color:#2563eb;text-decoration:underline;">${appUrl}/predictions</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 20px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;${FONT}">
                worldcup2026friend.com · Jeu entre amis · Gratuit · Sans paris d'argent
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
