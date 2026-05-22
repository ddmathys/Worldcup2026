import { NextRequest, NextResponse } from "next/server";
import { getAllUsers } from "@/lib/firestore";
import { getResend } from "@/lib/resend";
import { buildNewsletterHtml } from "@/lib/newsletter-template";
import type { NewsletterSection } from "@/lib/newsletter-template";

interface SendBody {
  subject: string;
  preheader: string;
  sections: NewsletterSection[];
  matchesToday: { home: string; away: string; time: string; group: string }[];
  matchesTomorrow: { home: string; away: string; time: string; group: string }[];
  dateStr: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as SendBody;
  const { subject, preheader, sections, matchesToday, matchesTomorrow, dateStr } = body;

  if (!subject || !sections?.length) {
    return NextResponse.json({ ok: false, error: "subject et sections requis" }, { status: 400 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://worldcup2026friend.com").replace(/\/$/, "");
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "WC2026 <noreply@worldcup2026friend.com>";

  const html = buildNewsletterHtml({
    subject,
    preheader,
    sections,
    matchesToday,
    matchesTomorrow,
    dateStr,
    appUrl,
  });

  const users = await getAllUsers();
  let sent = 0;
  const errors: string[] = [];

  for (const user of users) {
    if (!user.email) continue;
    try {
      await getResend().emails.send({ from: fromAddress, to: user.email, subject, html });
      sent++;
    } catch (err) {
      errors.push(`${user.email}: ${err}`);
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    total: users.length,
    ...(errors.length ? { errors } : {}),
  });
}
