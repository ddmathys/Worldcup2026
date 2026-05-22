export interface NewsletterSection {
  title: string;
  emoji: string;
  content: string;
}

interface MatchPreview {
  home: string;
  away: string;
  time: string;
  group: string;
}

interface NewsletterTemplateOptions {
  subject: string;
  preheader: string;
  sections: NewsletterSection[];
  matchesToday: MatchPreview[];
  matchesTomorrow: MatchPreview[];
  dateStr: string;
  appUrl: string;
}

function matchRow(m: MatchPreview): string {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;width:48px;">Gr.&nbsp;${m.group}</td>
            <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:center;">${m.home}</td>
            <td style="color:#f59e0b;font-size:12px;font-weight:800;text-align:center;width:32px;">vs</td>
            <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:center;">${m.away}</td>
            <td style="color:#64748b;font-size:12px;text-align:right;width:52px;">${m.time}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function sectionBlock(s: NewsletterSection): string {
  const paragraphs = s.content
    .split(/\n\n+/)
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#cbd5e1;font-size:15px;line-height:1.75;">${p.trim()}</p>`
    )
    .join("");

  return `
    <tr>
      <td style="padding:0 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px 4px;">
              <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#f1f5f9;">
                ${s.emoji}&nbsp;&nbsp;${s.title}
              </p>
              ${paragraphs}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function buildNewsletterHtml(opts: NewsletterTemplateOptions): string {
  const { subject, preheader, sections, matchesToday, matchesTomorrow, dateStr, appUrl } = opts;

  const todayBlock =
    matchesToday.length > 0
      ? `
    <tr>
      <td style="padding:0 32px 28px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:2px;">
          ⚽ Matchs aujourd'hui
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:8px 16px;">
          ${matchesToday.map(matchRow).join("")}
        </table>
      </td>
    </tr>`
      : "";

  const tomorrowBlock =
    matchesTomorrow.length > 0 && matchesToday.length === 0
      ? `
    <tr>
      <td style="padding:0 32px 28px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">
          📅 Au programme demain
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:8px 16px;">
          ${matchesTomorrow.map(matchRow).join("")}
        </table>
      </td>
    </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e293b;border-radius:20px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#7c3aed 100%);padding:32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#93c5fd;">
                Coupe du Monde 2026
              </p>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">
                ⚽ La Gazette WC2026
              </h1>
              <p style="margin:0;color:#bfdbfe;font-size:13px;">${dateStr}</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="height:28px;"></td></tr>

          ${sections.map(sectionBlock).join("")}
          ${todayBlock}
          ${tomorrowBlock}

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${appUrl}/predictions"
                 style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:16px 44px;border-radius:12px;">
                Voir mes pronostics →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                Tu reçois cet email car tu es inscrit sur worldcup2026friend.com.<br>
                Jeu de pronostics entre amis · Gratuit · Sans paris d'argent.
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
