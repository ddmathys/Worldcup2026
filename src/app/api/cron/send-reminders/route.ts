import { NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAllUsers } from "@/lib/firestore";
import { getResend } from "@/lib/resend";
import { buildReminderEmail } from "@/lib/email-templates";

// Days before the first match that trigger a milestone email to all users.
const MILESTONE_DAYS = new Set([10, 5, 1]);

// Only start sending daily reminders this many days before the first match.
const DAILY_WINDOW_DAYS = 10;

function daysUntil(target: Date, from: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((target.getTime() - from.getTime()) / msPerDay);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Find the first upcoming group-stage match to use as the deadline.
  const firstMatchSnap = await getDocs(
    query(
      collection(db, "matches"),
      where("phase", "==", "group"),
      orderBy("kickoffUtc", "asc"),
      limit(1)
    )
  );

  if (firstMatchSnap.empty) {
    return NextResponse.json({ ok: false, reason: "no group-stage matches found" });
  }

  const firstMatchData = firstMatchSnap.docs[0].data();
  const firstKickoff: Date = firstMatchData.kickoffUtc?.toDate?.() ?? new Date();
  const days = daysUntil(firstKickoff);

  // Tournament already started — skip.
  if (days < 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "tournament already started" });
  }

  const isMilestone = MILESTONE_DAYS.has(days);
  const isDailyWindow = days <= DAILY_WINDOW_DAYS;

  if (!isMilestone && !isDailyWindow) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `J-${days} — outside reminder window`,
    });
  }

  // Count total group-stage matches (= max predictions per user).
  const allMatchesSnap = await getDocs(
    query(collection(db, "matches"), where("phase", "==", "group"))
  );
  const totalMatches = allMatchesSnap.size;

  const users = await getAllUsers();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://worldcup2026friend.com").replace(/\/$/, "");
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "WC2026 <noreply@worldcup2026friend.com>";

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of users) {
    if (!user.email) { skipped++; continue; }

    const hasIncomplete = user.predictionsCount < totalMatches;

    // Milestone days → send to everyone.
    // Daily window → send only to users with missing predictions.
    const shouldSend = isMilestone || hasIncomplete;
    if (!shouldSend) { skipped++; continue; }

    const { subject, html } = buildReminderEmail({
      pseudo: user.pseudo,
      daysUntilFirstMatch: days,
      predictionsCount: user.predictionsCount,
      totalMatches,
      appUrl,
    });

    try {
      await getResend().emails.send({ from: fromAddress, to: user.email, subject, html });
      sent++;
    } catch (err) {
      errors.push(`${user.email}: ${err}`);
    }
  }

  return NextResponse.json({
    ok: true,
    daysUntilFirstMatch: days,
    isMilestone,
    totalUsers: users.length,
    sent,
    skipped,
    ...(errors.length ? { errors } : {}),
  });
}
