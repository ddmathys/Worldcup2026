import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getResend } from "@/lib/resend";
import { buildPasswordResetEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  try {
    const resetLink = await getAdminAuth().generatePasswordResetLink(email, {
      url: "https://worldcup2026friend.com/login",
    });

    const { subject, html } = buildPasswordResetEmail(resetLink);

    await getResend().emails.send({
      from: "WC2026 <noreply@worldcup2026friend.com>",
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
    if (code === "auth/user-not-found") {
      // Ne pas révéler si l'email existe ou non
      return NextResponse.json({ ok: true });
    }
    console.error("reset-password error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
