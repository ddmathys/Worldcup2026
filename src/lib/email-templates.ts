interface ReminderEmailOptions {
  pseudo: string;
  daysUntilFirstMatch: number;
  predictionsCount: number;
  totalMatches: number;
  appUrl: string;
}

export function buildReminderEmail({
  pseudo,
  daysUntilFirstMatch,
  predictionsCount,
  totalMatches,
  appUrl,
}: ReminderEmailOptions): { subject: string; html: string } {
  const remaining = totalMatches - predictionsCount;
  const progressPercent = Math.round((predictionsCount / totalMatches) * 100);
  const isComplete = remaining <= 0;

  let subject: string;
  let headline: string;
  let urgenceColor: string;

  if (daysUntilFirstMatch === 1) {
    subject = "⚽ Dernière chance — le tournoi commence demain !";
    headline = "Dernier jour avant le coup d'envoi !";
    urgenceColor = "#ef4444";
  } else if (daysUntilFirstMatch === 5) {
    subject = "⚽ J-5 avant la Coupe du Monde 2026 — tes pronostics ?";
    headline = "Plus que 5 jours avant le premier match !";
    urgenceColor = "#f59e0b";
  } else if (daysUntilFirstMatch === 10) {
    subject = "⚽ J-10 — La Coupe du Monde 2026 approche !";
    headline = "La Coupe du Monde arrive dans 10 jours !";
    urgenceColor = "#3b82f6";
  } else {
    subject = isComplete
      ? `⚽ J-${daysUntilFirstMatch} — Tu es prêt(e) pour le tournoi !`
      : `⚽ J-${daysUntilFirstMatch} — ${remaining} pronostic${remaining > 1 ? "s" : ""} manquant${remaining > 1 ? "s" : ""}`;
    headline = `Plus que ${daysUntilFirstMatch} jours avant le coup d'envoi`;
    urgenceColor = daysUntilFirstMatch <= 3 ? "#ef4444" : "#f59e0b";
  }

  let bodyMessage: string;
  if (isComplete) {
    bodyMessage = `Bravo ${pseudo} ! Tu as complété tous tes pronostics pour la phase de groupes. Tu es prêt(e) à affronter tes amis.`;
  } else if (predictionsCount === 0) {
    bodyMessage = `Tu n'as pas encore commencé tes pronostics. Il te reste <strong style="color:#f1f5f9">${totalMatches} matchs</strong> à prédire avant le début du tournoi !`;
  } else {
    bodyMessage = `Tu as déjà pronostiqué <strong style="color:#f1f5f9">${predictionsCount} match${predictionsCount > 1 ? "s" : ""}</strong> sur ${totalMatches}. Il t'en reste <strong style="color:${urgenceColor}">${remaining}</strong> — ne laisse pas tes amis prendre de l'avance !`;
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e293b;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#7c3aed 100%);padding:36px 32px;text-align:center;">
              <div style="font-size:52px;line-height:1;margin-bottom:12px;">⚽</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                Coupe du Monde 2026
              </h1>
              <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">worldcup2026friend.com</p>
            </td>
          </tr>

          <!-- Countdown badge -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <div style="display:inline-block;background-color:#0f172a;border-radius:14px;padding:20px 36px;border:1px solid #334155;">
                <span style="display:block;font-size:56px;font-weight:800;color:${urgenceColor};line-height:1;">
                  ${daysUntilFirstMatch}
                </span>
                <span style="display:block;font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#94a3b8;margin-top:4px;">
                  jour${daysUntilFirstMatch > 1 ? "s" : ""} restant${daysUntilFirstMatch > 1 ? "s" : ""}
                </span>
              </div>
              <h2 style="margin:20px 0 0;color:#f1f5f9;font-size:18px;font-weight:600;line-height:1.4;">
                ${headline}
              </h2>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">Bonjour <strong style="color:#f1f5f9;">${pseudo}</strong>,</p>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.7;">
                ${bodyMessage}
              </p>

              <!-- Progress -->
              <div style="background-color:#0f172a;border-radius:12px;padding:20px;margin-bottom:28px;border:1px solid #334155;">
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                  <tr>
                    <td style="color:#94a3b8;font-size:13px;">Pronostics phase de groupes</td>
                    <td align="right" style="color:#f1f5f9;font-weight:700;font-size:15px;">${predictionsCount}&thinsp;/&thinsp;${totalMatches}</td>
                  </tr>
                </table>
                <div style="background-color:#334155;border-radius:99px;height:10px;overflow:hidden;">
                  <div style="background:linear-gradient(90deg,#3b82f6,#8b5cf6);height:100%;width:${progressPercent}%;border-radius:99px;"></div>
                </div>
                <p style="margin:8px 0 0;color:#475569;font-size:12px;text-align:right;">${progressPercent}% complété</p>
              </div>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/predictions"
                       style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:16px 44px;border-radius:10px;letter-spacing:0.2px;">
                      ${isComplete ? "Voir mes pronostics" : "Compléter mes pronostics →"}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                Tu reçois cet email car tu es inscrit sur worldcup2026friend.com.<br>
                Jeu de pronostics entre amis · Gratuit · Sans paris d'argent.<br>
                <a href="${appUrl}" style="color:#64748b;text-decoration:underline;">Se désabonner</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
