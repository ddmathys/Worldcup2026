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

// ─── HTML building blocks ────────────────────────────────────────────────────

function paragraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${p.trim()}</p>`
    )
    .join("");
}

function matchCard(m: MatchRow): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
  <tr>
    <td style="background:linear-gradient(135deg,#0a1628,#0d1f3c);border:1px solid #1e3a5f;border-radius:16px;padding:20px 24px;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#60a5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ⚽&nbsp;&nbsp;Coup d'envoi · ${m.time} &nbsp;|&nbsp; Groupe ${m.group}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="42%" style="text-align:right;">
            <span style="font-size:22px;font-weight:900;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${m.home}</span>
          </td>
          <td width="16%" style="text-align:center;">
            <span style="font-size:13px;font-weight:900;color:#f59e0b;background:#f59e0b18;border:1px solid #f59e0b40;padding:4px 10px;border-radius:8px;font-family:monospace;">VS</span>
          </td>
          <td width="42%" style="text-align:left;">
            <span style="font-size:22px;font-weight:900;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${m.away}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function pullQuoteBlock(quote: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="border-left:4px solid #f59e0b;padding:4px 20px 4px 24px;">
      <p style="margin:0;font-size:17px;font-style:italic;color:#e2e8f0;line-height:1.7;font-family:Georgia,serif;">${quote}</p>
    </td>
  </tr>
</table>`;
}

function keyPlayerBlock(kp: KeyPlayer): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background:linear-gradient(135deg,#1a1035,#0d1f40);border:1px solid #2d3f6a;border-radius:16px;padding:20px 24px;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#a78bfa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ⚡ Joueur à surveiller
      </p>
      <p style="margin:0 0 2px;font-size:22px;font-weight:900;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${kp.name}</p>
      <p style="margin:0 0 12px;font-size:12px;color:#60a5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${kp.team}</p>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${kp.role}</p>
    </td>
  </tr>
</table>`;
}

function articleBlock(a: Article, isFirst: boolean): string {
  const tagColor = isFirst ? "#f59e0b" : "#60a5fa";
  const border = isFirst
    ? "border-top:2px solid #f59e0b;"
    : "border-top:1px solid #1e293b;";

  return `
<tr>
  <td style="padding:28px 36px 32px;${border}">
    ${a.matchTitle ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Match · ${a.matchTitle}</p>` : ""}
    <p style="margin:0 0 10px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:4px;color:${tagColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${a.tag}</p>
    <h2 style="margin:0 0 20px;font-size:${isFirst ? "26px" : "20px"};font-weight:900;color:#f1f5f9;line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${a.title}</h2>
    ${paragraphs(a.content)}
    ${a.pullQuote ? pullQuoteBlock(a.pullQuote) : ""}
    ${a.keyPlayer ? keyPlayerBlock(a.keyPlayer) : ""}
  </td>
</tr>`;
}

function statBlock(s: StatOfDay): string {
  return `
<tr>
  <td style="padding:0 36px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:linear-gradient(135deg,#1a1035,#0d1f40);border-radius:20px;padding:32px;text-align:center;border:1px solid #2d3f6a;">
          <p style="margin:0 0 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:4px;color:#a78bfa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Le chiffre du jour</p>
          <p style="margin:0;font-size:72px;font-weight:900;color:#f59e0b;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            ${s.number}${s.unit ? `<span style="font-size:28px;"> ${s.unit}</span>` : ""}
          </p>
          <p style="margin:12px 0 0;font-size:14px;color:#94a3b8;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${s.label}</p>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function scheduleBlock(label: string, matches: MatchRow[]): string {
  if (!matches.length) return "";
  return `
<tr>
  <td style="padding:0 36px 28px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:3px;color:#475569;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${label}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#060d1f;border-radius:14px;overflow:hidden;">
      ${matches
        .map(
          (m, i) => `
      <tr style="${i > 0 ? "border-top:1px solid #0f1d35;" : ""}">
        <td style="padding:12px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:36px;color:#475569;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Gr.${m.group}</td>
              <td style="text-align:center;color:#e2e8f0;font-size:13px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${m.home}</td>
              <td style="text-align:center;width:28px;color:#f59e0b;font-size:11px;font-weight:900;font-family:monospace;">—</td>
              <td style="text-align:center;color:#e2e8f0;font-size:13px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${m.away}</td>
              <td style="text-align:right;width:44px;color:#475569;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${m.time}</td>
            </tr>
          </table>
        </td>
      </tr>`
        )
        .join("")}
    </table>
  </td>
</tr>`;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildNewsletterHtml(draft: NewsletterDraft, appUrl: string): string {
  const { subject, preheader, headline, intro, articles, statOfDay, matchesToday, matchesTomorrow, dateStr } = draft;

  const hasMatchesToday = matchesToday.length > 0;
  const hasMatchesTomorrow = matchesTomorrow.length > 0;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#060d1f;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#060d1f;">${preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#060d1f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

          <!-- ░░ HERO ░░ -->
          <tr>
            <td style="background:linear-gradient(160deg,#030b1a 0%,#0d1f40 55%,#1a0a2e 100%);border-radius:20px 20px 0 0;padding:44px 36px 40px;border-bottom:1px solid #f59e0b;">
              <p style="margin:0 0 20px;font-size:10px;font-weight:800;letter-spacing:5px;text-transform:uppercase;color:#f59e0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                ⚽ La Gazette WC2026
              </p>
              <h1 style="margin:0 0 16px;font-size:32px;font-weight:900;color:#ffffff;line-height:1.2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                ${headline}
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#93c5fd;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${intro}</p>
              <p style="margin:0;font-size:11px;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:2px;">${dateStr}</p>
            </td>
          </tr>

          <!-- ░░ BODY ░░ -->
          <tr>
            <td style="background:#0f1729;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Match cards today -->
                ${
                  hasMatchesToday
                    ? `<tr><td style="padding:28px 36px 4px;">
                  <p style="margin:0 0 14px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:3px;color:#f59e0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">⚽ Au programme aujourd'hui</p>
                  ${matchesToday.map(matchCard).join("")}
                </td></tr>`
                    : ""
                }

                <!-- Articles -->
                ${articles.map((a, i) => articleBlock(a, i === 0)).join("")}

                <!-- Stat of day -->
                ${statOfDay ? statBlock(statOfDay) : ""}

                <!-- Tomorrow schedule -->
                ${hasMatchesTomorrow && !hasMatchesToday ? scheduleBlock("📅 Au programme demain", matchesTomorrow) : ""}

              </table>
            </td>
          </tr>

          <!-- ░░ CTA ░░ -->
          <tr>
            <td style="background:#0f1729;padding:4px 36px 36px;text-align:center;">
              <a href="${appUrl}/predictions"
                 style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#7c3aed);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:16px 48px;border-radius:12px;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Mes pronostics →
              </a>
            </td>
          </tr>

          <!-- ░░ FOOTER ░░ -->
          <tr>
            <td style="background:#060d1f;border-radius:0 0 20px 20px;padding:20px 36px 28px;border-top:1px solid #0f1d35;text-align:center;">
              <p style="margin:0;color:#334155;font-size:12px;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
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
