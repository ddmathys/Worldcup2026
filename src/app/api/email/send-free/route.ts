import { NextRequest, NextResponse } from "next/server";
import { getAllUsersAdmin } from "@/lib/firestore-admin";
import { getResend } from "@/lib/resend";
import { buildFreeEmailHtml } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const { subject, body, testEmail } = await req.json() as { subject: string; body: string; testEmail?: string };

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ ok: false, error: "Sujet et corps requis" }, { status: 400 });
    }

    const from = process.env.RESEND_FROM_EMAIL ?? "WC2026 <noreply@dmathys.dev>";

    // Test mode : envoie uniquement à l'adresse de test
    if (testEmail) {
      const html = buildFreeEmailHtml(subject, body, "Prénom");
      const { data, error } = await getResend().emails.send({ from, to: testEmail, subject: `[TEST] ${subject}`, html });
      if (error) {
        console.error("Resend test error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, sent: 1, total: 1, test: true, id: data?.id });
    }

    let users;
    try {
      users = await getAllUsersAdmin();
    } catch (err) {
      console.error("getAllUsers failed:", err);
      return NextResponse.json({ ok: false, error: `Firestore error: ${err}` }, { status: 500 });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const user of users) {
      if (!user.email) continue;
      try {
        const html = buildFreeEmailHtml(subject, body, user.pseudo ?? "toi");
        const { error: sendErr } = await getResend().emails.send({ from, to: user.email, subject, html });
        if (sendErr) {
          console.error(`send to ${user.email} failed:`, sendErr);
          errors.push(`${user.email}: ${sendErr.message}`);
        } else {
          sent++;
        }
      } catch (err) {
        console.error(`send to ${user.email} failed:`, err);
        errors.push(`${user.email}: ${err}`);
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      total: users.length,
      ...(errors.length ? { errors } : {}),
    });
  } catch (err) {
    console.error("send-free top-level error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
